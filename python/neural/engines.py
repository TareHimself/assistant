import torch
import json
from neural.model import IntentsNeuralNet, NERModel
from neural.utils import PYTORCH_DEVICE
from neural.train import train_intents, train_ner


class IntentsEngine:
    def __init__(self, intents: list, model_path: str):
        self.model_path = model_path

        train_intents(intents, model_path)

        self.model = IntentsNeuralNet.load(model_path)

    def update_intents(self, intents: list):
        train_intents(intents, self.model_path)
        self.model = IntentsNeuralNet.load(self.model_path)

    def get_intent(self, msg: str):
        return self.model.predict(msg)

    def ready(self):
        self.model = self.model.to(PYTORCH_DEVICE)
        self.model.eval()
        return self


class NEREngine:
    def __init__(self, intents: list, model_path: str):
        self.model_path = model_path

        train_ner(intents, model_path)

        self.model = NERModel.load(model_path)

    def update_intents(self, intents: list):
        train_ner(intents, self.model_path)
        self.model = NERModel.load(self.model_path)

    def get_entities(self, msg: str, intent: str = ""):
        return self.model.predict(msg, intent)

    def ready(self):
        self.model = self.model.to(PYTORCH_DEVICE)
        self.model.eval()
        return self
