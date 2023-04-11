import hashlib
import re
from torchtext.data.utils import get_tokenizer
from torchtext.vocab import build_vocab_from_iterator
from transformers import BertTokenizerFast
from numwrd import num2wrd
import torch


EMBEDDINGS_MODEL = 'bert-base-uncased'
PYTORCH_DEVICE = torch.device('cuda:0' if torch.cuda.is_available() else 'cpu')

tokenizer = BertTokenizerFast.from_pretrained(EMBEDDINGS_MODEL)


EXTRACT_VARIATIONS_REGEX = r"\[(.*?)\]"
ENTITIES_REGEX = r"<e-([a-z_]+)>(.+?)<\/e-\1>"
NONE_ENTITIES_REGEX = r"[A-Za-z0-9!]+|[\"#$%&'()*+,\-.\/:;<=>?@\[\\\]^_`{|}~]+"


def build_vocab(words: list, special_tokens=['<unk>'], default_token='<unk>'):
    vocab = build_vocab_from_iterator([words], min_freq=1,
                                      specials=special_tokens)

    vocab.set_default_index(vocab[default_token])

    return vocab


def tokenize(text: str):
    return tokenizer(text, padding='max_length',  max_length=512, return_attention_mask=True,
                     truncation=True, return_tensors="pt")
    # tokens = []
    # split_tok = text.split(" ")

    # for tok in split_tok:
    #     cur = tok.strip().lower()
    #     if len(cur) <= 0:
    #         continue

    #     if cur.isnumeric():
    #         tokens.append(num2wrd(int(cur)))
    #     else:
    #         tokens.append(cur)

    # return tokens
    #
    # tokens = _tokenizer(text)
    # return


def replace_at_depth(current_value, cur_depth, variations):
    if cur_depth < len(variations):
        converted = []
        for variation in variations[cur_depth]:
            replaced_current = current_value.replace(
                f"${cur_depth}", variation.strip())
            converted.extend(replace_at_depth(
                replaced_current, cur_depth + 1, variations))
        return converted
    else:
        return [current_value]


def compute_expanded_example(example: str):
    variations = re.findall(EXTRACT_VARIATIONS_REGEX, example, re.DOTALL)
    replace_template = example
    for i in range(len(variations)):
        replace_template = replace_template.replace(
            f"[{variations[i]}]", f"${i}", 1)

    actual_variations = list(map(lambda a: a.split("|"), variations))

    return replace_at_depth(replace_template, 0, actual_variations)


def expand_all_examples(intents: list):
    for intent in intents:
        new_examples = []
        for example in intent['examples']:
            new_examples.extend(compute_expanded_example(example))
        intent['examples'] = new_examples
    return intents


def hash_intents(intents: list):
    final_string = ""
    for intent in intents:
        tag = intent['tag']
        for example in intent['examples']:
            final_string += f'{tag.replace(" ", "").lower()}{example.replace(" ", "").lower()}'

    return hashlib.md5(final_string.encode()).hexdigest()


def increase_size(items: list, target: int):
    start_len = len(items)
    for i in range(max(target - start_len, 0)):
        items.append(items[i % start_len])

    return items


def mimic_bert_split(target: str):
    # print("BREAKING", target, re.findall(NONE_ENTITIES_REGEX, target))
    return re.findall(NONE_ENTITIES_REGEX, target)


def extract_entities(all_entities: list, example: list, prefix=''):
    prefix = ''
    matches = re.findall(ENTITIES_REGEX, example)
    entity_tags = ''
    new_example = example
    remaining = example
    for i in range(len(matches)):
        entity, entity_example = matches[i]
        # remove the literal entity tag
        remaining = remaining.replace(
            f"<e-{entity}>", '').replace(f"</e-{entity}>", '')
        new_example = new_example.replace(
            f"<e-{entity}>", '').replace(f"</e-{entity}>", '')

        entity = entity.upper()
        # find the index of the entity in the example
        target_index = remaining.index(entity_example)

        # cut out said entity
        to_tag = remaining[target_index:target_index+len(entity_example)]

        # ensure we have entires in the vocab
        all_entities.append(f"B-{prefix}{entity}")
        all_entities.append(f"I-{prefix}{entity}")

        # tag each word in the entity
        tagged = " ".join([f"B-{prefix}{entity}" if i ==
                           0 else f"I-{prefix}{entity}" for i in range(len(mimic_bert_split(to_tag)))])

        # tag all the previous words with the 'O' tag
        before_entities = " ".join(['O' for x in mimic_bert_split(
            remaining[0:target_index])])

        # combine the previous data and the currently tagged entities
        entity_tags += " " + before_entities + " " + tagged
        entity_tags.strip()

        remaining = remaining[target_index +
                              len(entity_example):len(remaining)]

    if len(remaining) > 0:
        entity_tags += " " + " ".join(['O' for x in mimic_bert_split(
            remaining[0:len(remaining)])])

    return (new_example, entity_tags.strip())
