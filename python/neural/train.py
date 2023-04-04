import numpy as np
import torch
import torch.nn as nn
from neural.datasets import IntentsDataset
from neural.model import IntentsNeuralNet
from torch.utils.data import DataLoader
from os import path
from neural.utils import hash_intents, expand_all_examples
from bridge import debug_string
from tqdm import tqdm
from neural.utils import PYTORCH_DEVICE


def train_intents(intents: list, save_path: str, batch_size=8, learning_rate=3e-4, epochs=4):
    expand_all_examples(intents)
    intents_hash = hash_intents(intents)
    if path.exists(save_path):
        old_data: dict = torch.load(save_path)
        if old_data.get('hash', "") == intents_hash:
            debug_string("No need to train new model, loading existing")
            return

    debug_string("Training new model")
    dataset = IntentsDataset(intents)

    train_loader = DataLoader(
        dataset=dataset, batch_size=batch_size, num_workers=0, shuffle=True)

    hidden_size = 256
    output_size = len(dataset.tags)
    debug_string("device" + PYTORCH_DEVICE.__str__())
    model = IntentsNeuralNet(hidden_size, output_size).to(PYTORCH_DEVICE)
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate)

    loading_bar = tqdm(
        total=epochs, desc=f'epoch {1}/{epochs} ::  Accuracy {(0):.4f} :: loss {0:.8f}')

    for epoch in range(epochs):
        total_accu, total_count = 0, 0
        for idx, data in enumerate(train_loader):
            labels, input_ids, attention_masks = data
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
