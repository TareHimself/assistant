import torch
import numpy as np
from tqdm import tqdm
from torch.utils.data import Dataset
from neural.utils import Vocabulary, increase_size, extract_entities


class IntentsDataset(Dataset):
    def __init__(self, d: list):
        self.tags = []
        self.train_examples = []
        self.train_labels = []
        self.train_entities = []
        count = []
        unbalanced = []

        for idx in range(len(d)):
            tag = d[idx]["tag"]
            self.tags.append(tag)
            examples = d[idx]["examples"]
            count.append(len(examples))
            unbalanced.append(examples)

        max_count = max(count)
        all_words = []
        all_entities = []
        for idx in range(len(unbalanced)):
            entities, examples = extract_entities(
                increase_size(unbalanced[idx], max_count)
            )
            for example, tagged_entities in examples:
                self.train_labels.append(idx)
                self.train_examples.append(example)
                self.train_entities.append(tagged_entities)
                all_words.extend(example)

            all_entities.extend(list(entities))

        self.words_vocab = Vocabulary.to_vocab(all_words, 3000)
        # self.entities_vocab.add(all_entities)
        all_words = []
        all_entities = []

        for i in range(len(self.train_examples)):
            # print(
            #     self.tags[self.train_labels[i]], " | ", " ".join(self.train_examples[i])
            # )
            self.train_examples[i] = np.array(
                self.words_vocab(" ".join(self.train_examples[i]), pad=True)
            )
            self.train_entities[i] = np.array([0])

        # balance = {}
        # for tag in self.train_labels:
        #     if self.tags[tag] not in balance.keys():
        #         balance[self.tags[tag]] = 1
        #     else:
        #         balance[self.tags[tag]] += 1

        # print("TAGS BALANCE", balance)
        # for i in range(len(self.train_entities)):
        #     self.train_entities[i] = np.array(
        #         self.entities_vocab(self.train_entities[i], max_tokens)
        #     )

    def __len__(self):
        return len(self.train_examples)

    def __getitem__(self, idx):
        return (
            self.train_labels[idx],
            self.train_examples[idx],
            self.train_entities[idx],
        )
