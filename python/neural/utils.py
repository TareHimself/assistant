import hashlib
import re
import torch
from numwrd import num2wrd


PYTORCH_DEVICE = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
# PYTORCH_DEVICE = torch.device(
#     "cuda:0"
#     if torch.cuda.is_available()
#     else "mps" Not supported by all items
#     if torch.backends.mps.is_available()
#     else "cpu"
# )
TOKENIZE_REGEX = r"[A-Za-z0-9!]+|[\"#$%&'()*+,\-.\/:;<=>?@\[\\\]^_`{|}~]+"
ENTITIES_REGEX = r"<e-([a-z_]+)>(.+?)<\/e-\1>"
EXTRACT_VARIATIONS_REGEX = r"\[(.*?)\]"


class Vocabulary:
    def __init__(self, initial={"#pad": 0, "#unk": 1}) -> None:
        self.last_new_index = max(initial.values()) + 1
        self.vocab = initial

    def add(self, items: list[str]):
        for x in items:
            if x not in self.vocab.keys():
                self.vocab[x] = self.last_new_index
                self.last_new_index += 1

    def __len__(self):
        return len(self.vocab.keys())

    def index(self, item: str) -> int:
        return self.vocab.get(item, 1)

    def __call__(self, words: list, length: int, use_sub=False) -> list[int]:
        words_length = len(words)
        return [self.index(words[x]) if x < words_length else 0 for x in range(length)]


def split_text(text: str):
    return re.findall(TOKENIZE_REGEX, text)


def tokenize(text: str):
    return list(map(lambda a: a.lower(), split_text(text)))


def extract_entities(examples: list, prefix=""):
    computed = []
    all_entities = set()
    for example in examples:
        matches = re.findall(ENTITIES_REGEX, example)
        entity_tags = ""
        new_example = example
        remaining = example
        for i in range(len(matches)):
            entity, entity_example = matches[i]

            # remove the literal entity tag
            remaining = remaining.replace(f"<e-{entity}>", "").replace(
                f"</e-{entity}>", ""
            )
            new_example = new_example.replace(f"<e-{entity}>", "").replace(
                f"</e-{entity}>", ""
            )

            # find the index of the entity in the example
            target_index = remaining.index(entity_example)

            # cut out said entity
            to_tag = remaining[target_index : target_index + len(entity_example)]

            # ensure we have entires in the vocab
            all_entities.add(f"B-{prefix}{entity}")
            all_entities.add(f"I-{prefix}{entity}")

            # tag each word in the entity
            tagged = " ".join(
                [
                    f"B-{prefix}{entity}" if i == 0 else f"I-{prefix}{entity}"
                    for i in range(len(split_text(to_tag)))
                ]
            )

            # tag all the previous words with the 'O' tag
            before_entities = " ".join(
                ["O" for x in split_text(remaining[0:target_index])]
            )

            # combine the previous data and the currently tagged entities
            entity_tags += " " + before_entities + " " + tagged
            entity_tags.strip()

            remaining = remaining[target_index + len(entity_example) : len(remaining)]

        if len(remaining) > 0:
            entity_tags += " " + " ".join(
                ["O" for x in split_text(remaining[0 : len(remaining)])]
            )
        computed.append((tokenize(new_example), entity_tags.strip().split()))

    return (all_entities, computed)


def replace_at_depth(current_value, cur_depth, variations):
    if cur_depth < len(variations):
        converted = []
        for variation in variations[cur_depth]:
            replaced_current = current_value.replace(f"${cur_depth}", variation.strip())
            converted.extend(
                replace_at_depth(replaced_current, cur_depth + 1, variations)
            )
        return converted
    else:
        return [current_value]


def compute_expanded_example(example: str):
    variations = re.findall(EXTRACT_VARIATIONS_REGEX, example, re.DOTALL)
    replace_template = example
    for i in range(len(variations)):
        replace_template = replace_template.replace(f"[{variations[i]}]", f"${i}", 1)

    actual_variations = list(map(lambda a: a.split("|"), variations))

    return replace_at_depth(replace_template, 0, actual_variations)


def expand_all_examples(intents: list):
    for intent in intents:
        new_examples = []
        for example in intent["examples"]:
            new_examples.extend(compute_expanded_example(example))
        intent["examples"] = new_examples
    return intents


def hash_intents(intents: list):
    final_string = ""
    for intent in intents:
        tag = intent["tag"]
        for example in intent["examples"]:
            final_string += (
                f'{tag.replace(" ", "").lower()}{example.replace(" ", "").lower()}'
            )

    return hashlib.md5(final_string.encode()).hexdigest()


def increase_size(items: list, target: int):
    start_len = len(items)
    for i in range(max(target - start_len, 0)):
        items.append(items[i % start_len])

    return items
