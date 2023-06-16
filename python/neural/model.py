import torch
from transformers import DistilBertModel, BertForTokenClassification
from torch import nn, mm, Tensor
from collections import deque
import torch.nn.functional as F
from neural.utils import (
    DISTIL_BERT_MODEL,
    DISTIL_BERT_TOKENIZER_FUNCTION,
    BERT_MODEL,
    BERT_TOKENIZER_FUNCTION,
    BERT_TOKENIZER,
    PYTORCH_DEVICE,
)


class IntentsNeuralNet(nn.Module):
    def __init__(self, labels):
        super().__init__()

        self.labels = labels
        self.em = DistilBertModel.from_pretrained(DISTIL_BERT_MODEL)
        self.fc = nn.Sequential(
            nn.Dropout(0.4),
            nn.Linear(768, 256),
            nn.ReLU(),
            nn.Linear(256, len(self.labels)),
        )

    def forward(self, input_ids, mask):
        distilbert_output = self.em(input_ids=input_ids, attention_mask=mask)
        hidden_state = distilbert_output[0]
        pooled_output = hidden_state[:, 0]

        x = self.fc(pooled_output)

        return x

    def predict(self, text: str):
        with torch.inference_mode():
            encodings = DISTIL_BERT_TOKENIZER_FUNCTION(text)
            output = self(
                encodings["input_ids"].to(PYTORCH_DEVICE),
                encodings["attention_mask"].to(PYTORCH_DEVICE),
            )

            probs = torch.softmax(output, dim=1)

            all_classes = [
                {"intent": self.labels[x], "confidence": probs[0][x].item()}
                for x in range(len(self.labels))
            ]

            all_classes.sort(key=lambda a: a["confidence"], reverse=True)

            return all_classes

    def save(self, hash: str, path: str):
        torch.save(
            {
                "state": self.state_dict(),
                "labels": self.labels,
                "hash": hash,
            },
            path,
        )

    @staticmethod
    def load(path: str):
        loaded_data = torch.load(path)
        model = IntentsNeuralNet(
            loaded_data["labels"],
        )
        model.load_state_dict(loaded_data["state"])
        return model


class NERModel(torch.nn.Module):
    def __init__(self, labels: list):
        super().__init__()

        self.bert = BertForTokenClassification.from_pretrained(
            BERT_MODEL, num_labels=len(labels)
        )

        self.labels = labels

    def forward(self, input_id, mask, label):
        output = self.bert(
            input_ids=input_id, attention_mask=mask, labels=label, return_dict=False
        )

        return output

    def save(self, hash: str, path: str, weights=None):
        torch.save(
            {
                "state": self.state_dict() if weights is None else weights,
                "labels": self.labels,
                "hash": hash,
            },
            path,
        )

    @staticmethod
    def load(path: str):
        loaded_data = torch.load(path)
        model = NERModel(
            loaded_data["labels"],
        )
        model.load_state_dict(loaded_data["state"])

        return model

    def predict(self, text: str, intent: str):
        with torch.inference_mode():
            encodings = BERT_TOKENIZER_FUNCTION(text)
            inputs = encodings["input_ids"].to(PYTORCH_DEVICE)
            logits = self(
                inputs,
                encodings["attention_mask"].to(PYTORCH_DEVICE),
                None,
            )

            # probs = torch.softmax(output, dim=1)

            # all_classes = [
            #     {"intent": self.labels[x], "confidence": probs[0][x].item()}
            #     for x in range(len(self.labels))
            # ]

            # all_classes.sort(key=lambda a: a["confidence"], reverse=True)
            indices = torch.max(logits[0][0], dim=1).indices

            tokens = BERT_TOKENIZER.convert_ids_to_tokens(encodings["input_ids"][0])

            entity_word_pairs = deque()

            encodings_ids = encodings.word_ids()

            for x in range(len(encodings_ids)):
                if encodings_ids[x] is not None:
                    entity_word_pairs.append(
                        (tokens[x], self.labels[indices[x].item()])
                    )

            final_entities = []
            pending_entity = None
            current = entity_word_pairs.popleft()

            while len(entity_word_pairs) > 0 or current is not None:
                word, entity = current
                # print(word, entity, pending_entity)
                has_pending = pending_entity is not None
                is_entity = entity.startswith("B") or entity.startswith("I")
                is_new_entity = is_entity and (
                    pending_entity[0] != entity[2:] if has_pending else True
                )
                is_subword = word.startswith("##")
                if has_pending and is_subword:
                    pending_entity[1] += word[2:]
                elif has_pending and is_new_entity:
                    if intent == "" or (
                        intent != "" and pending_entity[0].startswith(intent)
                    ):
                        final_entities.append(
                            (pending_entity[0][len(intent) :], pending_entity[1])
                        )
                    pending_entity = [entity[2:], word]
                elif has_pending and is_entity:
                    pending_entity[1] += f" {word}"
                elif has_pending and entity == "O":
                    if intent == "" or (
                        intent != "" and pending_entity[0].startswith(intent)
                    ):
                        final_entities.append((pending_entity[0], pending_entity[1]))
                    pending_entity = None
                elif not has_pending and is_new_entity:
                    pending_entity = [entity[2:], word]

                current = (
                    entity_word_pairs.popleft() if len(entity_word_pairs) > 0 else None
                )

            if pending_entity is not None:
                if intent == "" or (
                    intent != "" and pending_entity[0].startswith(intent)
                ):
                    final_entities.append(
                        (pending_entity[0][len(intent) :], pending_entity[1])
                    )

            return final_entities


# class IntentsNeuralNet(torch.nn.Module):
#     def __init__(self):
#         super().__init__()
#         self.distill_bert = DistilBertModel.from_pretrained(NLP_MODEL)
#         self.drop = torch.nn.Dropout(0.3)
#         self.out = torch.nn.Linear(768, 1)

#     def forward(self, ids, mask):
#         distilbert_output = self.distill_bert(ids, mask)
#         hidden_state = distilbert_output[0]  # (bs, seq_len, dim)
#         pooled_output = hidden_state[:, 0]  # (bs, dim)
#         output_1 = self.drop(pooled_output)
#         output = self.out(output_1)
#         return output


# class IntentsNeuralNet(nn.Module):
#     def __init__(self, vocab_dize, embed_dimensions, hidden_size, num_classes):
#         super().__init__()
#         self.em = nn.EmbeddingBag(vocab_dize, embed_dimensions, sparse=False)
#         self.fc1 = nn.Linear(embed_dimensions, hidden_size)
#         self.fc2 = nn.Linear(hidden_size, num_classes)

#     def forward(self, tokens: Tensor, offsets: Tensor):
#         x = self.em(tokens, offsets)
#         x = torch.tanh(self.fc1(x))
#         x = self.fc2(x)
#         return x


# class IntentsNeuralNet(nn.Module):
#     def __init__(self, vocab: Vocabulary, embed_dimensions, hidden_size, classes):
#         super().__init__()
#         self.vocab = vocab
#         self.e_dim = embed_dimensions
#         self.h_size = hidden_size
#         self.classes = classes
#         self.device = torch.device('cpu')
#         self.em = nn.EmbeddingBag(len(self.vocab), self.e_dim, sparse=False)
#         self.fc = nn.Sequential(
#             nn.Linear(self.e_dim, self.h_size),
#             nn.ReLU(),
#             nn.Dropout(.3),
#             nn.Linear(self.h_size, self.h_size),
#             nn.ReLU(),
#             nn.Linear(self.h_size, len(self.classes)),
#             nn.Dropout(.3)
#         )

#     def forward(self, tokens: Tensor):

#         offset = None if len(tokens.shape) > 1 else torch.IntTensor(
#             [0]).to(self.device)

#         x = self.em(tokens, offset)

#         x = self.fc(x)

#         return x

#     def save(self, hash: str, path: str):
#         torch.save({
#             "state": self.state_dict(),
#             "vocab": self.vocab.vocab,
#             "e_dim": self.e_dim,
#             "h_size": self.h_size,
#             "classes": self.classes,
#             "hash": hash
#         }, path)

#     def predict(self, text: str):
#         sentence = tokenize(text)
#         x = self.vocab(sentence, 64)
#         x = torch.IntTensor(x)
#         output = self(x)
#         _, predicated = torch.max(output, dim=1)

#         probs = torch.softmax(output, dim=1)
#         prob = probs[0][predicated.item()]

#         all_classes = [{
#             "intent": self.classes[x],
#             "confidence": probs[0][x].item()
#         }
#             for x in range(len(self.classes))]

#         all_classes.sort(key=lambda a: a['confidence'], reverse=True)

#         return all_classes

#     @staticmethod
#     def load(path: str):
#         loaded_data = torch.load(path)
#         model = IntentsNeuralNet(Vocabulary(
#             loaded_data['vocab']), loaded_data['e_dim'], loaded_data['h_size'], loaded_data['classes'])
#         model.load_state_dict(loaded_data['state'])
#         return model

#     def to_device(self, d):
#         return self.to(d)


# class IntentsNeuralNet(nn.Module):
#     def __init__(self, vocab: Vocabulary, embed_dimensions, hidden_size, classes):
#         super().__init__()
#         self.vocab = vocab
#         self.e_dim = embed_dimensions
#         self.h_size = hidden_size
#         self.classes = classes
#         self.device = torch.device("cpu")
#         self.em = nn.EmbeddingBag(len(self.vocab), self.e_dim, sparse=False)
#         self.lstm = nn.LSTM(
#             input_size=self.e_dim, hidden_size=self.h_size, num_layers=4, dropout=0.3
#         )
#         self.fc1 = nn.Linear(self.h_size, len(self.classes))

#     def forward(self, tokens: Tensor):
#         offset = None if len(tokens.shape) > 1 else torch.IntTensor([0]).to(self.device)

#         x = self.em(tokens, offset)

#         x, _ = self.lstm(x)

#         x = self.fc1(x)

#         return x

#     def save(self, weights, hash: str, path: str):
#         torch.save(
#             {
#                 "state": self.state_dict() if weights is None else weights,
#                 "vocab": self.vocab.vocab,
#                 "e_dim": self.e_dim,
#                 "h_size": self.h_size,
#                 "classes": self.classes,
#                 "hash": hash,
#             },
#             path,
#         )

#     def predict(self, text: str):
#         x = self.vocab(text, pad=True)
#         x = torch.IntTensor(x)
#         output = self(x)
#         _, predicated = torch.max(output, dim=1)

#         probs = torch.softmax(output, dim=1)
#         prob = probs[0][predicated.item()]

#         all_classes = [
#             {"intent": self.classes[x], "confidence": probs[0][x].item()}
#             for x in range(len(self.classes))
#         ]

#         all_classes.sort(key=lambda a: a["confidence"], reverse=True)

#         return all_classes

#     @staticmethod
#     def load(path: str):
#         loaded_data = torch.load(path)
#         model = IntentsNeuralNet(
#             Vocabulary(loaded_data["vocab"]),
#             loaded_data["e_dim"],
#             loaded_data["h_size"],
#             loaded_data["classes"],
#         )
#         model.load_state_dict(loaded_data["state"])
#         return model

#     def to_device(self, d):
#         self.device = d
#         return self.to(d)


# class TokenClassificationNet(nn.Module):
#     def __init__(self, vocab_size, embed_dimensions, hidden_size, num_classes):
#         super().__init__()
#         self.embedding = nn.Embedding(vocab_size, embed_dimensions)
#         self.fc1 = nn.Linear(embed_dimensions, hidden_size)
#         self.fc2 = nn.Linear(hidden_size, num_classes)

#     def forward(self, tokens: Tensor):
#         # tokens: batch_size x sequence_length
#         # batch_size x sequence_length x embed_dimensions
#         embedded = self.embedding(tokens)
#         # (batch_size * sequence_length) x embed_dimensions
#         embedded = embedded.view(-1, embedded.size(2))
#         # (batch_size * sequence_length) x hidden_size
#         x = F.relu(self.fc1(embedded))
#         x = self.fc2(x)  # (batch_size * sequence_length) x num_classes
#         # batch_size x sequence_length x num_classes
#         x = x.view(-1, tokens.size(1), x.size(1))
#         return x
