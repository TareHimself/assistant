import torch
import torchtext as tt
from tqdm import tqdm
from torch.utils.data import Dataset
from neural.utils import tokenize, build_vocab, increase_size


class IntentsDataset(Dataset):
    def __init__(self, d: list, tokenizer=tokenize):
        self.tags = []
        self.train_x = []
        self.train_y = []
        self.tokenizer = tokenizer
        self.words = []

        count = []
        unbalanced = []

        for idx in range(len(d)):
            tag = d[idx]['tag']
            self.tags.append(tag)
            examples = d[idx]['examples']
            count.append(len(examples))
            unbalanced.append(examples)

        max_count = max(count)

        for idx in range(len(unbalanced)):
            for example in increase_size(unbalanced[idx], max_count):
                self.train_y.append(idx)
                self.train_x.append(self.tokenizer(example))
                self.words.extend(self.tokenizer(example))

        self.words = list(set(self.words))

        self.vocab = build_vocab(self.words)

    def __len__(self):
        return len(self.train_x)

    def __getitem__(self, idx):
        return self.train_y[idx], self.train_x[idx]
