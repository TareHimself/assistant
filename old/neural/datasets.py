import torch
import torchtext as tt
from tqdm import tqdm
import numpy as np
from torch.utils.data import Dataset
from neural.utils import tokenize, build_vocab, increase_size, extract_entities, expand_all_examples


class NluDataset(Dataset):
    def __init__(self, d: list, tokenizer=tokenize):
        self.intents = expand_all_examples(d.copy())
        self.tags = []
        self.labels = []
        self.input_ids = []
        self.attention_masks = []
        self.entities = []
        self.tokenizer = tokenizer
        self.all_entities = []

        count = []
        unbalanced = []

        for idx in range(len(self.intents)):
            tag = self.intents[idx]['tag']
            self.tags.append(tag)
            examples = self.intents[idx]['examples']
            examples = [extract_entities(
                self.all_entities, e, prefix=f'{idx}') for e in examples]
            count.append(len(examples))
            unbalanced.append(examples)

        max_count = max(count)
        self.all_entities = list(set(self.all_entities))
        self.all_entities.insert(0, 'O')

        for idx in range(len(unbalanced)):
            for example, entities in increase_size(unbalanced[idx], max_count):
                entities = entities.split(' ')
                self.labels.append(idx)
                tokenized = self.tokenizer(example)
                self.input_ids.append(tokenized['input_ids'])
                self.attention_masks.append(tokenized['attention_mask'])
                self.entities.append(np.array([0]))
                # word_ids = tokenized.word_ids()
                # print(entities)
                # entities_ids = np.array(
                #     [self.all_entities.index(entities[x]) if x is not None else -100 for x in word_ids])
                # self.entities.append(entities_ids)
                # print(example, entities)
                # print(example, tokenized['input_ids'], entities_ids)

        # self.words = list(set(self.words))

        # self.vocab = build_vocab(self.words)

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
        return self.labels[idx], self.input_ids[idx].squeeze(0), self.attention_masks[idx], self.entities[idx]
