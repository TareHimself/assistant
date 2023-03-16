import torch
from neural.model import IntentsNeuralNet
from neural.utils import build_vocab, tokenize
from neural.train import train_intents


class IntentsEngine:
    def __init__(self, intents: list, model_path: str):
        self.model_path = model_path

        train_intents(intents, model_path)
        self.data = torch.load(model_path)
        self.model = IntentsNeuralNet(
            self.data['input'], self.data['e_dim'], self.data['hidden'], self.data['output'])

        self.vocab = build_vocab(self.data['words'])
        self.model.load_state_dict(self.data['state'])
        self.model.eval()

    def update_intents(self, intents: list):
        train_intents(intents, self.model_path)

        self.model = IntentsNeuralNet(
            self.data['input'], self.data['e_dim'], self.data['hidden'], self.data['output'])
        self.vocab = build_vocab(self.data['words'])
        self.model.load_state_dict(self.data['state'])
        self.model.eval()

    def get_intent(self, msg: str):
        sentence = tokenize(msg)
        x = self.vocab(sentence)
        x = torch.IntTensor(x)
        output = self.model(x, torch.IntTensor([0]))
        _, predicated = torch.max(output, dim=1)

        probs = torch.softmax(output, dim=1)
        prob = probs[0][predicated.item()]

        return prob.item(), self.data['tags'][predicated.item()]
