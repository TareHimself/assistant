import torch
import numpy as np
import torchtext as tt
from tqdm import tqdm
from torch.utils.data import Dataset
from neural.utils import tokenize, Vocabulary, increase_size, extract_entities


class IntentsDataset(Dataset):
    def __init__(self, d: list, tokenizer=tokenize, max_tokens=64):
        self.tags = []
        self.train_examples = []
        self.train_labels = []
        self.train_entities = []
        self.tokenizer = tokenizer
        self.words_vocab = Vocabulary()
        self.entities_vocab = Vocabulary(initial={"#pad": 0, 'O': 1})
        count = []
        unbalanced = []

        for idx in range(len(d)):
            tag = d[idx]['tag']
            self.tags.append(tag)
            examples = d[idx]['examples']
            count.append(len(examples))
            unbalanced.append(examples)

        max_count = max(count)
        all_words = []
        all_entities = []
        for idx in range(len(unbalanced)):
            entities, examples = extract_entities(
                increase_size(unbalanced[idx], max_count))
            for example, tagged_entities in examples:
                self.train_labels.append(idx)
                self.train_examples.append(example)
                self.train_entities.append(tagged_entities)
                all_words.extend(example)

            all_entities.extend(list(entities))

        self.words_vocab.add(all_words)
        self.entities_vocab.add(all_entities)
        all_words = []
        all_entities = []

        for i in range(len(self.train_examples)):
            self.train_examples[i] = np.array(
                self.words_vocab(self.train_examples[i], max_tokens))

        for i in range(len(self.train_entities)):
            self.train_entities[i] = np.array(
                self.entities_vocab(self.train_entities[i], max_tokens))

    def __len__(self):
        return len(self.train_examples)

    def __getitem__(self, idx):
        return self.train_labels[idx], self.train_examples[idx], self.train_entities[idx]
