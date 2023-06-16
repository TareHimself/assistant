import numpy as np
import torch
import torch.nn as nn
from neural.model import IntentsNeuralNet, NERModel
from neural.datasets import IntentsDataset, NERDataset
from torch.utils.data import DataLoader
from os import path
from neural.utils import (
    hash_intents,
    expand_all_examples,
    PYTORCH_DEVICE,
    DISTIL_BERT_MODEL,
)
from tqdm import tqdm
from copy import deepcopy


def train_intents(
    intents: list,
    save_path: str,
    learning_rate=5e-5,
    epochs=4,
    patience=30,
):
    expand_all_examples(intents)
    intents_hash = hash_intents(intents)
    if path.exists(save_path):
        old_data: dict = torch.load(save_path)
        if old_data.get("hash", "") == intents_hash:
            print("No need to train new model, loading existing")
            return

    print("Training new model")

    dataset = IntentsDataset(intents)

    # def collate_data(batch):
    #     nonlocal dataset
    #     # rearrange a batch and compute offsets too
    #     # needs a global vocab and tokenizer
    #     label_lst, review_lst, offset_lst = [], [], [0]
    #     for _lbl, _rvw in batch:
    #         label_lst.append(int(_lbl))  # string to int
    #         idxs = []
    #         for tok in _rvw:
    #             idxs.append(dataset.words_vocab[tok])

    #         idxs = torch.tensor(idxs, dtype=torch.int64)  # to tensor
    #         review_lst.append(idxs)
    #         offset_lst.append(len(idxs))

    #     label_lst = torch.tensor(label_lst, dtype=torch.int64).to(PYTORCH_DEVICE)
    #     offset_lst = torch.tensor(offset_lst[:-1]).cumsum(dim=0).to(PYTORCH_DEVICE)
    #     review_lst = torch.cat(review_lst).to(PYTORCH_DEVICE)  # 2 tensors to 1

    #     return label_lst, review_lst, offset_lst

    train_loader = DataLoader(
        dataset=dataset, batch_size=16, num_workers=0, shuffle=True
    )

    print("device" + PYTORCH_DEVICE.__str__())
    model = IntentsNeuralNet(dataset.tags).to(PYTORCH_DEVICE)
    optimizer = torch.optim.AdamW(model.parameters(), lr=5e-5)
    criterion = nn.CrossEntropyLoss()
    loading_bar = tqdm(
        total=epochs, desc=f"epoch {1}/{epochs} ::  Accuracy unknown :: loss unknown"
    )

    for epoch in range(epochs):
        total_accu, total_count = 0, 0
        total_loss, loss_count = 0, 0
        for idx, data in enumerate(train_loader):
            label, input_ids, attention_masks = data
            label = label.to(PYTORCH_DEVICE)
            input_ids = input_ids.to(PYTORCH_DEVICE)
            attention_masks = attention_masks.to(PYTORCH_DEVICE)
            # print(label, text)

            outputs = model(input_ids, attention_masks)

            loss = criterion(outputs, label)

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_accu += (outputs.argmax(1) == label).sum().item()
            total_count += label.size(0)
            total_loss += loss.item()
            loss_count += 1

        accu_val = total_accu / total_count
        loss_val = total_loss / loss_count
        loading_bar.update()
        loading_bar.set_description_str(
            f"epoch {epoch + 1}/{epochs} ::  Accuracy {(accu_val * 100):.4f} :: loss {loss_val:.4f}"
        )

    model.save(intents_hash, save_path)


def train_ner(
    intents: list,
    save_path: str,
    learning_rate=5e-5,
    epochs=90,
    patience=30,
):
    expand_all_examples(intents)
    intents_hash = hash_intents(intents)
    if path.exists(save_path):
        old_data: dict = torch.load(save_path)
        if old_data.get("hash", "") == intents_hash:
            print("No need to train new model, loading existing")
            return

    print("Training new model")

    dataset = NERDataset(intents)

    # def collate_data(batch):
    #     nonlocal dataset
    #     # rearrange a batch and compute offsets too
    #     # needs a global vocab and tokenizer
    #     label_lst, review_lst, offset_lst = [], [], [0]
    #     for _lbl, _rvw in batch:
    #         label_lst.append(int(_lbl))  # string to int
    #         idxs = []
    #         for tok in _rvw:
    #             idxs.append(dataset.words_vocab[tok])

    #         idxs = torch.tensor(idxs, dtype=torch.int64)  # to tensor
    #         review_lst.append(idxs)
    #         offset_lst.append(len(idxs))

    #     label_lst = torch.tensor(label_lst, dtype=torch.int64).to(PYTORCH_DEVICE)
    #     offset_lst = torch.tensor(offset_lst[:-1]).cumsum(dim=0).to(PYTORCH_DEVICE)
    #     review_lst = torch.cat(review_lst).to(PYTORCH_DEVICE)  # 2 tensors to 1

    #     return label_lst, review_lst, offset_lst

    train_loader = DataLoader(
        dataset=dataset, batch_size=3, num_workers=0, shuffle=True
    )

    print("device" + PYTORCH_DEVICE.__str__())
    model = NERModel(dataset.possible_entities).to(PYTORCH_DEVICE)
    optimizer = torch.optim.AdamW(model.parameters(), lr=5e-5)
    loading_bar = tqdm(
        total=epochs, desc=f"epoch {1}/{epochs} ::  Accuracy unknown :: loss unknown"
    )
    best_weights = deepcopy(model.state_dict())
    best_loss = 99999999
    for epoch in range(epochs):
        total_accu, total_count = 0, 0
        total_loss, loss_count = 0, 0
        for idx, data in enumerate(train_loader):
            label, input_ids, attention_masks = data
            label = label.type(torch.LongTensor).to(PYTORCH_DEVICE)
            input_ids = input_ids.to(PYTORCH_DEVICE)
            attention_masks = attention_masks.to(PYTORCH_DEVICE)
            # print(label, text)

            loss, logits = model(input_ids, attention_masks, label)

            for i in range(logits.shape[0]):
                logits_clean = logits[i][label[i] != -100]
                label_clean = label[i][label[i] != -100]

                predictions = logits_clean.argmax(dim=1)
                acc = (predictions == label_clean).sum()
                total_accu += acc
                total_count += predictions.size(0)
                loss_count += label.size(0)
                total_loss += loss.item()

            loss.backward()
            optimizer.step()

        accu_val = total_accu / total_count
        loss_val = total_loss / loss_count
        loading_bar.update()
        loading_bar.set_description_str(
            f"epoch {epoch + 1}/{epochs} ::  Accuracy {(accu_val * 100):.4f} :: loss {loss_val:.4f}"
        )

        if total_loss < best_loss:
            best_weights = deepcopy(model.state_dict())
            best_loss = total_loss

    model.save(intents_hash, save_path)
