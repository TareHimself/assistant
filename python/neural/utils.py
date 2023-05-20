import hashlib
import re
import torch
import string
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
MAX_MODEL_TOKENS = 200


def split_text(text: str) -> list[str]:
    return re.findall(TOKENIZE_REGEX, text)


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
        computed.append((split_text(new_example), entity_tags.strip().split()))

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
            final_string += f'{tag.replace(" ", "")}{example.replace(" ", "")}'

    return hashlib.md5(final_string.encode()).hexdigest()


def increase_size(items: list, target: int):
    start_len = len(items)
    for i in range(max(target - start_len, 0)):
        items.append(items[i % start_len])

    return items


class Vocabulary:
    RESERVED_KEY_PAD = "[PAD]"
    RESERVED_KEY_WHITESPACE = "[WHITESPACE]"
    RESERVED_VOCAB = {RESERVED_KEY_WHITESPACE: 0, RESERVED_KEY_PAD: 1}
    MIN_FREQUENCY = 5
    LOWERCASE_ONLY = True

    def __init__(self, initial={}) -> None:
        self.last_new_index = max(initial.values()) + 1
        self.vocab = initial
        self.inv_vocab = {v: k for k, v in self.vocab.items()}

    @staticmethod
    def merge_pairs(item: str, text_chars: list[str]):
        """if text is 'an' and text_chars is ['a','n','n','a'] the result will be ['an','n','a']"""
        if len(item) > len(text_chars):
            return text_chars

        merged = []
        to_merge = text_chars.copy()
        iterations = 0
        while len(to_merge) > 0:
            if len(to_merge) < len(item):
                merged.extend(to_merge[0 : len(to_merge)])
                to_merge = []
                iterations += 1
                continue

            window = "".join(to_merge[0:2])

            if window == item:
                merged.append(window)
                to_merge = to_merge[2:]
            else:
                merged.append(to_merge[0])
                to_merge = to_merge[1:]
            iterations += 1
        return merged

    @staticmethod
    def get_most_freq_pair(
        texts: list[list[list[str]]], ignore_list: set[str] = []
    ) -> tuple[str, int]:
        frequencies = {}
        for sentences in texts:
            for chars in sentences:
                for i in range(len(chars) - 1):
                    pair = "".join(chars[i : i + 2])
                    if pair not in frequencies.keys():
                        frequencies[pair] = 1
                    else:
                        frequencies[pair] += 1
        result = max(
            frequencies.items(), key=lambda a: a[1] if a[0] not in ignore_list else 0
        )
        if result[0] in ignore_list:
            return (result[0], 0)
        return result

    def to_vocab(texts: list[str], max_size=300):
        all_chars = list()

        def to_chars(sen: str):
            nonlocal all_chars
            chars: list[str] = []
            full_sen = sen.lower() if Vocabulary.LOWERCASE_ONLY else sen
            for x in split_text(full_sen):
                char = [y for y in x]
                all_chars.extend(char)
                chars.append(char)
            return chars

        data = texts.copy()
        data = [to_chars(x) for x in data]

        new_vocab = list(
            set(
                all_chars
                + [x for x in string.punctuation]
                + [x for x in string.digits]
                # + [x for x in string.ascii_uppercase]
                + [x for x in string.ascii_lowercase]
            )
        )

        new_vocab = sorted(new_vocab)

        cur_vocab_size = len(new_vocab) + len(Vocabulary.RESERVED_VOCAB.keys())

        ignore_list = set()

        while cur_vocab_size < max_size:
            most_freq, freq = Vocabulary.get_most_freq_pair(data, ignore_list)

            if freq == 0 or freq < Vocabulary.MIN_FREQUENCY:
                break
            if most_freq in new_vocab:
                ignore_list.add(most_freq)
                continue
            new_vocab.append(most_freq)
            cur_vocab_size += 1
            for x in range(len(data)):
                for y in range(len(data[x])):
                    data[x][y] = Vocabulary.merge_pairs(most_freq, data[x][y])
        final_vocab = Vocabulary.RESERVED_VOCAB.copy()
        len_reserved = len(final_vocab)
        for i in range(len(new_vocab)):
            final_vocab[new_vocab[i]] = i + len_reserved

        return Vocabulary(final_vocab)

    def add(self, items: list[str]):
        for x in items:
            if x not in self.vocab.keys():
                self.vocab[x] = self.last_new_index
                self.last_new_index += 1

    def __len__(self):
        return len(self.vocab.keys())

    def index(self, item: str) -> int:
        return self.vocab.get(item, 1)

    def compute_word_tokens(self, word: str):
        w_len = len(word)
        word_tokens = []
        word_left = word
        while len(word_left) > 0:
            longest_match = None
            longest_match_section = None
            for i in reversed(range(w_len)):
                test_section = word_left[0 : i + 1]
                possible_match = self.vocab.get(test_section, None)
                if possible_match is not None:
                    longest_match = possible_match
                    longest_match_section = test_section
                    break
            if longest_match is not None:
                word_tokens.append(longest_match)
                word_left = word_left[len(longest_match_section) :]
            else:
                break

        return word_tokens

    def __call__(
        self, text: str, max_tokens: int = MAX_MODEL_TOKENS, pad=False
    ) -> list[int]:
        tokens = []
        for word in (text.lower() if Vocabulary.LOWERCASE_ONLY else text).split():
            word_tokens = []
            for word_section in split_text(word):
                word_tokens.extend(self.compute_word_tokens(word_section))
            if len(tokens) > 0:
                tokens.append(self.vocab[Vocabulary.RESERVED_KEY_WHITESPACE])
            tokens.extend(word_tokens)

        print(
            "Tokenized |", text, "| Into |", tokens, file=open("vocab debug.txt", "w")
        )
        if len(tokens) > max_tokens:
            print(f"Truncating {len(tokens) - max_tokens} tokens")

        if len(tokens) < max_tokens and pad:
            tokens = tokens + [
                Vocabulary.RESERVED_VOCAB[Vocabulary.RESERVED_KEY_PAD]
                for i in range(max_tokens - len(tokens))
            ]
        return tokens[:max_tokens]

        words_length = len(words)
        return [
            self.index(words[x]) if x < words_length else 0 for x in range(max_tokens)
        ]
