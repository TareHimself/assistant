import numpy as np
import torch
import torch.nn as nn
from neural.datasets import IntentsDataset
from neural.model import IntentsNeuralNet, TokenClassificationNet
from torch.utils.data import DataLoader
from os import path
from neural.utils import hash_intents, expand_all_examples, PYTORCH_DEVICE
from tqdm import tqdm


def train_intents(
    intents: list,
    save_path: str,
    batch_size=64,
    learning_rate=0.001,
    epochs=350,
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

    def collate_data(batch):
        nonlocal dataset
        # rearrange a batch and compute offsets too
        # needs a global vocab and tokenizer
        label_lst, review_lst, offset_lst = [], [], [0]
        for _lbl, _rvw in batch:
            label_lst.append(int(_lbl))  # string to int
            idxs = []
            for tok in _rvw:
                idxs.append(dataset.words_vocab[tok])

            idxs = torch.tensor(idxs, dtype=torch.int64)  # to tensor
            review_lst.append(idxs)
            offset_lst.append(len(idxs))

        label_lst = torch.tensor(label_lst, dtype=torch.int64).to(PYTORCH_DEVICE)
        offset_lst = torch.tensor(offset_lst[:-1]).cumsum(dim=0).to(PYTORCH_DEVICE)
        review_lst = torch.cat(review_lst).to(PYTORCH_DEVICE)  # 2 tensors to 1

        return label_lst, review_lst, offset_lst

    train_loader = DataLoader(
        dataset=dataset, batch_size=batch_size, num_workers=0, shuffle=True
    )

    embed_dim = 100
    hidden_size = 256
    print("device" + PYTORCH_DEVICE.__str__())
    model = IntentsNeuralNet(
        dataset.words_vocab, embed_dim, hidden_size, dataset.tags
    ).to_device(PYTORCH_DEVICE)
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate)

    loading_bar = tqdm(
        total=epochs, desc=f"epoch {0}/{epochs} ::  Accuracy unknown :: loss unknown"
    )

    best_weights = None
    best_loss = 999999
    no_improvement_counter = 0
    for epoch in range(epochs):
        total_accu, total_count = 0, 0
        total_loss, loss_count = 0, 0
        for idx, data in enumerate(train_loader):
            label, text, _ = data
            label = label.to(PYTORCH_DEVICE)
            text = text.to(PYTORCH_DEVICE)
            # print(label, text)

            outputs = model(text)

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
        if loss_val < best_loss:
            best_loss = loss_val
            best_weights = model.state_dict()
            no_improvement_counter = 0
        no_improvement_counter += 1
        if no_improvement_counter == patience:
            loading_bar.close()
            print("Stopping due to no improvement")
            break
        loading_bar.update()
        loading_bar.set_description_str(
            f"epoch {epoch + 1}/{epochs} ::  Accuracy {(accu_val * 100):.4f} :: loss {loss_val:.4f}"
        )

    model.save(best_weights, intents_hash, save_path)


def train_entities(
    intents: list, save_path: str, batch_size=64, learning_rate=1e-4, epochs=200
):
    expand_all_examples(intents)
    intents_hash = hash_intents(intents)
    if path.exists(save_path):
        old_data: dict = torch.load(save_path)
        if old_data.get("hash", "") == intents_hash:
            print("No need to train new model, loading existing")
            return

    dataset = IntentsDataset(intents)

    # def collate_data(batch):
    #     nonlocal dataset
    #     # rearrange a batch and compute offsets too
    #     # needs a global vocab and tokenizer
    #     label_lst, review_lst, offset_lst = [], [], [0]
    #     for (_lbl, _rvw) in batch:
    #         label_lst.append(int(_lbl))  # string to int
    #         idxs = []
    #         for tok in _rvw:
    #             idxs.append(dataset.words_vocab[tok])

    #         idxs = torch.tensor(idxs, dtype=torch.int64)  # to tensor
    #         review_lst.append(idxs)
    #         offset_lst.append(len(idxs))

    #     label_lst = torch.tensor(
    #         label_lst, dtype=torch.int64).to(PYTORCH_DEVICE)
    #     offset_lst = torch.tensor(
    #         offset_lst[:-1]).cumsum(dim=0).to(PYTORCH_DEVICE)
    #     review_lst = torch.cat(review_lst).to(PYTORCH_DEVICE)  # 2 tensors to 1

    #     return label_lst, review_lst, offset_lst

    train_loader = DataLoader(
        dataset=dataset, batch_size=batch_size, num_workers=0, shuffle=True
    )

    input_size = len(dataset.words_vocab)
    embed_dim = 300
    hidden_size = 512
    output_size = len(dataset.entities_vocab)
    print("device" + PYTORCH_DEVICE.__str__())
    model = TokenClassificationNet(input_size, embed_dim, hidden_size, output_size).to(
        PYTORCH_DEVICE
    )
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate)

    loading_bar = tqdm(
        total=epochs, desc=f"epoch {0}/{epochs} ::  Accuracy unknown :: loss unknown"
    )
    best_weights = None
    best_loss = 999999
    for epoch in range(epochs):
        for idx, data in enumerate(train_loader):
            label, text, entities = data
            entities = entities.type(torch.LongTensor).to(PYTORCH_DEVICE)
            text = text.type(torch.LongTensor).to(PYTORCH_DEVICE)
            # print(label, text)

            outputs = model(text)
            loss = criterion(outputs.view(-1, outputs.size(-1)), entities.view(-1))

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            # Compute and return accuracy
            total_accu += (
                outputs.argmax(dim=2) == entities
            ).sum().item() / entities.flatten().shape[0]
            total_count += entities.size(0)
            loss_count += 1
            total_loss += loss.item()

        loading_bar.update()
        loading_bar.set_description_str(
            f"epoch {epoch + 1}/{epochs} ::  Accuracy {(accu_val * 100):.4f} :: loss {(loss_val):.4f}"
        )

    data_to_save = {
        "state": model.state_dict(),
        "input": input_size,
        "e_dim": embed_dim,
        "hidden": hidden_size,
        "vocab": dataset.entities_vocab.vocab,
        "hash": intents_hash,
    }

    torch.save(data_to_save, save_path)
