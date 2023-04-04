import torch
import torchtext as tt
from tqdm import tqdm
from torch.utils.data import Dataset
from neural.utils import tokenize, build_vocab, increase_size


class IntentsDataset(Dataset):
    def __init__(self, d: list, tokenizer=tokenize):
        self.tags = []
        self.labels = []
        self.input_ids = []
        self.attention_masks = []
        self.tokenizer = tokenizer

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
                self.labels.append(idx)
                data = self.tokenizer(example)
                self.input_ids.append(data['input_ids'])
                self.attention_masks.append(data['attention_mask'])

        # self.words = list(set(self.words))

        # self.vocab = build_vocab(self.words)

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
        return self.labels[idx], self.input_ids[idx].squeeze(0), self.attention_masks[idx]
