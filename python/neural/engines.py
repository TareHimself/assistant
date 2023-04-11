import torch
from neural.model import IntentsNeuralNet, EntityExtractor
from neural.utils import build_vocab, tokenize, PYTORCH_DEVICE, tokenizer
from neural.train import train_intents, train_entities


class IntentsEngine:
    def __init__(self, intents: list, model_path: str):
        self.model_path = model_path

        train_intents(intents, model_path)
        self.data = torch.load(model_path)

        self.model = IntentsNeuralNet(
            self.data['hidden'], self.data['output']).to(PYTORCH_DEVICE)
        self.model.load_state_dict(self.data['state'])
        self.model.eval()

    def update_intents(self, intents: list):
        train_intents(intents, self.model_path)

        self.model = IntentsNeuralNet(
            self.data['hidden'], self.data['output']).to(PYTORCH_DEVICE)
        self.model.load_state_dict(self.data['state'])
        self.model.eval()

    def get_intent(self, msg: str):
        sentence = tokenize(msg)
        mask = sentence['attention_mask'].to(PYTORCH_DEVICE)
        input_id = sentence['input_ids'].to(PYTORCH_DEVICE)
        output = self.model(input_id, mask)
        _, predicated = torch.max(output, dim=1)

        probs = torch.softmax(output, dim=1)
        prob = probs[0][predicated.item()]

        return prob.item(), self.data['tags'][predicated.item()]


class EntitiesEngine:
    def __init__(self, intents: list, model_path: str):
        self.model_path = model_path
        self.update_intents(intents)

    def update_intents(self, intents: list):
        train_entities(intents, self.model_path)
        self.data = torch.load(self.model_path)
        self.vocab = self.data['entities']
        self.model = EntityExtractor(len(self.vocab)).to(PYTORCH_DEVICE)
        self.model.load_state_dict(self.data['state'])
        self.model.eval()

    def get_entities(self, msg: str):
        sentence = tokenize(msg)
        mask = sentence['attention_mask'].to(PYTORCH_DEVICE)
        input_id = sentence['input_ids'].clone().to(PYTORCH_DEVICE)

        output = self.model(input_id, mask, None)[0]

        toIndex = torch.argmax(
            output, dim=2)[0]
        probs = torch.softmax(output, dim=2)[0]

        final = []
        tokens = []

        tokenized = tokenizer(msg)
        tokens = tokenizer.convert_ids_to_tokens(sentence['input_ids'][0])
        word_ids = tokenized.word_ids()

        counter = 0
        for index in sentence.word_ids():
            if index is not None:
                predicted_index = toIndex[index].item()
                probability = probs[index][predicted_index].item()
                final.append(
                    (self.vocab[predicted_index], probability, counter))
            counter += 1

        final_dict = []
        current_start, current_end = -1, -1
        is_parsing_item = False
        current_items = []
        last_start = ''

        for item in final:
            item_type, probs, token_index = item

            if item_type == 'O' and is_parsing_item:
                current_end = token_index
                final_dict.append({
                    'text': tokenizer.convert_tokens_to_string(
                        tokens[current_start: current_end]),
                    'score': sum(current_items) / len(current_items),
                    'entity': last_start[2:len(last_start)]
                })
                is_parsing_item = False
                last_start = ''
                current_start, current_end = -1, -1
                current_items = []

            if item_type.startswith('B'):
                if not is_parsing_item:
                    current_start = token_index
                    is_parsing_item = True
                    last_start = item_type
                    current_items.append(probs)
                    print("Started parsing")
                elif item_type != last_start:
                    current_end = token_index
                    final_dict.append({
                        'text': tokenizer.convert_tokens_to_string(
                            tokens[current_start: current_end]),
                        'score': sum(current_items) / len(current_items),
                        'entity': last_start[2:len(last_start)]
                    })
                    is_parsing_item = False
                    last_start = ''
                    current_start, current_end = -1, -1
                    current_items = []

            if item_type.startswith('I'):
                if is_parsing_item:
                    current_items.append(probs)
        print(output[0][0])
        if current_start != -1:

            last_item = final[len(final) - 1]
            final_dict.append({
                'text': tokenizer.convert_tokens_to_string(
                    tokens[current_start:last_item[2] + 1]),
                'score': sum(current_items) / len(current_items),
                'entity': last_start[2:len(last_start)]
            })
        return final_dict
        # indices = output[0]
        # result = [self.vocab[x] if len(
        #     self.vocab) > x > 0 else self.vocab[0] for x in indices]
        # print(output, output.argmax(dim=1).tolist(), result)
