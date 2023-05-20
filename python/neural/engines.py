import torch
import json
from neural.model import IntentsNeuralNet, TokenClassificationNet
from neural.utils import Vocabulary
from neural.train import train_intents, train_entities


class IntentsEngine:
    def __init__(self, intents: list, model_path: str):
        self.model_path = model_path

        train_intents(intents, model_path)

        self.model = IntentsNeuralNet.load(model_path)

        self.model.eval()

        with open("vocab_dump.json", "w") as vd:
            json.dump(self.model.vocab.vocab, vd, indent=2)

    def update_intents(self, intents: list):
        train_intents(intents, self.model_path)
        IntentsNeuralNet.load(self.model_path)
        self.model.eval()
        with open("vocab_dump.json", "w") as vd:
            json.dump(self.model.vocab.vocab, vd, indent=2)

    def get_intent(self, msg: str):
        return self.model.predict(msg)


class EntitiesEngine:
    def __init__(self, intents: list, model_path: str):
        self.model_path = model_path

        train_entities(intents, model_path)
        self.data = torch.load(model_path)
        self.vocab = Vocabulary(self.data["vocab"])
        self.model = TokenClassificationNet(
            self.data["input"], self.data["e_dim"], self.data["hidden"], len(self.vocab)
        )

        self.model.load_state_dict(self.data["state"])
        self.model.eval()

    def update_intents(self, intents: list):
        train_entities(intents, self.model_path)
        self.vocab = Vocabulary(self.data["vocab"])

        self.model = TokenClassificationNet(
            self.data["input"], self.data["e_dim"], self.data["hidden"], len(self.vocab)
        )

        self.model.load_state_dict(self.data["state"])
        self.model.eval()

    def get_intent(self, msg: str):
        x = self.vocab(msg)
        x = torch.IntTensor(x)
        output = self.model(x)
        _, predicated = torch.max(output, dim=1)

        probs = torch.softmax(output, dim=1)
        prob = probs[0][predicated.item()]

        return prob.item(), self.data["tags"][predicated.item()]
