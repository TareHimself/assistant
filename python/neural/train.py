import numpy as np
import torch
import torch.nn as nn
from neural.datasets import NluDataset
from neural.model import IntentsNeuralNet, EntityExtractor
from torch.utils.data import DataLoader
from os import path
from neural.utils import hash_intents, expand_all_examples
from tqdm import tqdm
from neural.utils import PYTORCH_DEVICE
import json


def train_intents(intents: list, save_path: str, batch_size=8, learning_rate=3e-4, epochs=7):
    intents_hash = hash_intents(intents)
    if path.exists(save_path):
        old_data: dict = torch.load(save_path)
        if old_data.get('hash', "") == intents_hash:
            print("No need to train new model, loading existing")
            return

    print("Training new model")
    dataset = NluDataset(intents)

    train_loader = DataLoader(
        dataset=dataset, batch_size=batch_size, num_workers=0, shuffle=True)

    hidden_size = 256
    output_size = len(dataset.tags)
    print("device", PYTORCH_DEVICE.__str__())
    model = IntentsNeuralNet(hidden_size, output_size).to(PYTORCH_DEVICE)
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate)

    loading_bar = tqdm(
        total=epochs, desc=f'epoch {1}/{epochs} ::  Accuracy {(0):.4f} :: loss {0:.8f}')

    for epoch in range(epochs):
        total_accu, total_count = 0, 0
        for idx, data in enumerate(train_loader):
            labels, input_ids, attention_masks, entities = data
            labels = labels.to(PYTORCH_DEVICE)
            input_ids = input_ids.to(PYTORCH_DEVICE)
            attention_masks = attention_masks.to(PYTORCH_DEVICE)

            # print(label, text)

            outputs = model(input_ids, attention_masks)
            loss = criterion(outputs, labels)

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_accu += (outputs.argmax(1) == labels).sum().item()
            total_count += labels.size(0)

        accu_val = total_accu / total_count
        loading_bar.update()
        loading_bar.set_description_str(
            f'epoch {epoch + 1}/{epochs} ::  Accuracy {(accu_val * 100):.4f} :: loss {loss.item():.8f}')

    data_to_save = {
        "state": model.state_dict(),
        "hidden": hidden_size,
        "output": len(dataset.tags),
        "tags": dataset.tags,
        "hash": intents_hash
    }

    torch.save(data_to_save, save_path)


def train_entities(intents: list, save_path: str, batch_size=8, learning_rate=5e-5, epochs=5):
    intents_hash = hash_intents(intents)
    if path.exists(save_path):
        old_data: dict = torch.load(save_path)
        if old_data.get('hash', "") == intents_hash:
            print("No need to train new model, loading existing")
            return

    print("Training new model")
    dataset = NluDataset(intents)

    train_loader = DataLoader(
        dataset=dataset, batch_size=batch_size, num_workers=0, shuffle=True)

    print("device", PYTORCH_DEVICE.__str__())
    model = EntityExtractor(len(dataset.all_entities)).to(PYTORCH_DEVICE)
    optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate)

    for epoch in range(epochs):
        loading_bar = tqdm(total=len(
            train_loader), desc=f'epoch {1}/{epochs} ::  Accuracy {(0):.4f} :: loss {0:.8f}')
        total_accu, total_count = 0, 0
        running_loss = 0
        for idx, data in enumerate(train_loader):
            _, input_ids, attention_masks, entities = data
            input_ids = input_ids.squeeze(0).to(PYTORCH_DEVICE)
            attention_masks = attention_masks.squeeze(0).to(PYTORCH_DEVICE)
            entities = entities.type(torch.LongTensor).to(PYTORCH_DEVICE)

            optimizer.zero_grad()

            loss, logits = model(input_ids, attention_masks, entities)

            for i in range(logits.shape[0]):

                logits_clean = logits[i][entities[i] != -100]
                label_clean = entities[i][entities[i] != -100]

                predictions = logits_clean.argmax(dim=1)
                total_accu += (predictions == label_clean).sum().item()
                total_count += label_clean.size(0)
            running_loss += loss.item()
            loss.backward()
            optimizer.step()
            loading_bar.set_description_str(
                f'epoch {epoch + 1}/{epochs} ::  Accuracy {((total_accu / total_count) * 100):.4f} :: loss {(running_loss / len(train_loader)):.8f}')
            loading_bar.update()

    data_to_save = {
        "state": model.state_dict(),
        "entities": dataset.all_entities,
        "hash": intents_hash
    }

    torch.save(data_to_save, save_path)
