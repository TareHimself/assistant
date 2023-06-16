import json
import torch
import numpy as np
from tqdm import tqdm
from torch.utils.data import Dataset
from neural.utils import (
    increase_size,
    extract_entities,
    DISTIL_BERT_TOKENIZER_FUNCTION,
    DISTIL_BERT_TOKENIZER,
    BERT_TOKENIZER_FUNCTION,
    BERT_TOKENIZER,
)


class IntentsDataset(Dataset):
    def __init__(self, d: list):
        self.tags = []
        self.input_ids = []
        self.attention_masks = []
        self.train_labels = []
        self.train_entities = []
        count = []
        unbalanced = []

        for idx in range(len(d)):
            tag = d[idx]["tag"]
            self.tags.append(tag)
            result = d[idx]["examples"]
            count.append(len(result))
            unbalanced.append(result)

        max_count = max(count)

        for idx in range(len(unbalanced)):
            entities_extracted, result = extract_entities(
                increase_size(unbalanced[idx], max_count)
            )
            for example, entity in result:
                encodings = DISTIL_BERT_TOKENIZER_FUNCTION(" ".join(example))
                self.train_labels.append(idx)
                self.input_ids.append(encodings["input_ids"])
                self.attention_masks.append(encodings["attention_mask"])

    def __len__(self):
        return len(self.input_ids)

    def __getitem__(self, idx):
        return (
            self.train_labels[idx],
            self.input_ids[idx].squeeze(0),
            self.attention_masks[idx],
        )


class NERDataset(Dataset):
    def __init__(self, d: list):
        self.tags = []
        self.input_ids = []
        self.attention_masks = []
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

        extracted_entities = ["O"]
        for idx in range(len(unbalanced)):
            current_entities_extracted, result = extract_entities(
                increase_size(unbalanced[idx], max_count), prefix=f"{self.tags[idx]}_"
            )
            for c in current_entities_extracted:
                if c not in extracted_entities:
                    extracted_entities.append(c)

            for example, entity_result in result:
                encodings = BERT_TOKENIZER_FUNCTION(" ".join(example))
                # BERT_TOKENIZER(
                #     " ".join(example), return_tensors="pt"
                # )  BERT_TOKENIZER_FUNCTION(" ".join(example))
                last_was_entity = False
                entities_as_ids = []
                words_tokens = BERT_TOKENIZER.convert_ids_to_tokens(
                    encodings["input_ids"][0]
                )
                for x in encodings.word_ids():
                    if x is None:
                        entities_as_ids.append(-100)
                        last_was_entity = False
                        continue

                    # print(
                    #     example,
                    #     x,
                    #     entity_result,
                    #     words_tokens[x],
                    #     "\n",
                    #     words_tokens,
                    #     "\n",
                    #     encodings.word_ids(),
                    #     file=open("test.txt", "w"),
                    # )
                    current = entity_result[x]
                    is_entity = current.startswith("B") or current.startswith("I")
                    if last_was_entity and is_entity:
                        entities_as_ids.append(
                            extracted_entities.index("I" + current[1:])
                        )
                    elif is_entity:
                        entities_as_ids.append(
                            extracted_entities.index("B" + current[1:])
                        )
                    else:
                        entities_as_ids.append(extracted_entities.index("O"))
                    last_was_entity = is_entity
                # print(
                #     f"Total Token IDS {len(BERT_TOKENIZER.convert_ids_to_tokens(encodings['input_ids'][0]))}",
                #     f"Total Entity IDS {len(entities_as_ids)}",
                # )

                self.train_labels.append(np.array(entities_as_ids))
                self.input_ids.append(encodings["input_ids"][0])
                self.attention_masks.append(encodings["attention_mask"][0])
        self.possible_entities = extracted_entities

    def __len__(self):
        return len(self.input_ids)

    def __getitem__(self, idx):
        return (
            self.train_labels[idx],
            self.input_ids[idx].squeeze(0),
            self.attention_masks[idx],
        )
