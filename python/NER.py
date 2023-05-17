from neural.utils import compute_expanded_example, tokenize, tokenizer, tokenizer
from torchtext.vocab import build_vocab_from_iterator
import re

example = "generate <e-statement>[white hair | blue eyes | white dress | pink lips ], [glasses | horns | purple eyes], [skirt | ember skin]</e-statement>"

# print(compute_expanded_example(example))
expanded = [
    "<e-start>generate</e-start> <e-statement>white hair, glasses, skirt</e-statement>",
    "generate <e-statement>white hair, glasses, ember skin</e-statement>",
    "generate <e-statement>white hair, horns, skirt</e-statement>",
    "generate <e-statement>white hair, horns, ember skin</e-statement>",
    "generate <e-statement>white hair, purple eyes, skirt</e-statement>",
    "generate <e-statement>white hair, purple eyes, ember skin</e-statement>",
    "generate <e-statement>blue eyes, glasses, skirt</e-statement>",
    "generate <e-statement>blue eyes, glasses, ember skin</e-statement>",
    "generate <e-statement>blue eyes, horns, skirt</e-statement>",
    "generate <e-statement>blue eyes, horns, ember skin</e-statement>",
    "generate <e-statement>blue eyes, purple eyes, skirt</e-statement>",
    "generate <e-statement>blue eyes, purple eyes, ember skin</e-statement>",
    "generate <e-statement>white dress, glasses, skirt</e-statement>",
    "generate <e-statement>white dress, glasses, ember skin</e-statement>",
    "generate <e-statement>white dress, horns, skirt</e-statement>",
    "generate <e-statement>white dress, horns, ember skin</e-statement>",
    "generate <e-statement>white dress, purple eyes, skirt</e-statement>",
    "generate <e-statement>white dress, purple eyes, ember skin</e-statement>",
    "generate <e-statement>pink lips, glasses, skirt</e-statement>",
    "generate <e-statement>pink lips, glasses, ember skin</e-statement>",
    "generate <e-statement>pink lips, horns, skirt</e-statement>",
    "generate <e-statement>pink lips, horns, ember skin</e-statement>",
    "generate <e-statement>pink lips, purple eyes, skirt</e-statement>",
    "generate <e-statement>pink lips, purple eyes, ember skin</e-statement>",
]

ENTITIES_REGEX = r"<e-([a-z_]+)>(.+?)<\/e-\1>"
NONE_ENTITIES_REGEX = r"[A-Za-z0-9!]+|[\"#$%&'()*+,\-.\/:;<=>?@\[\\\]^_`{|}~]+"


entities_vocab = list()


def mimic_bert_split(target: str):
    # print("BREAKING", target, re.findall(NONE_ENTITIES_REGEX, target))
    return re.findall(NONE_ENTITIES_REGEX, target)


def extract_entities(examples: list, prefix=""):
    computed = []
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
            entities_vocab.append(f"B-{prefix}{entity}")
            entities_vocab.append(f"I-{prefix}{entity}")

            # tag each word in the entity
            tagged = " ".join(
                [
                    f"B-{prefix}{entity}" if i == 0 else f"I-{prefix}{entity}"
                    for i in range(len(mimic_bert_split(to_tag)))
                ]
            )

            # tag all the previous words with the 'O' tag
            before_entities = " ".join(
                ["O" for x in mimic_bert_split(remaining[0:target_index])]
            )

            # combine the previous data and the currently tagged entities
            entity_tags += " " + before_entities + " " + tagged
            entity_tags.strip()

            remaining = remaining[target_index + len(entity_example) : len(remaining)]

        if len(remaining) > 0:
            entity_tags += " " + " ".join(
                ["O" for x in mimic_bert_split(remaining[0 : len(remaining)])]
            )
        computed.append((new_example, entity_tags.strip()))

    return computed


def tokenize_with_ner(example: str):
    tokenized = tokenizer(original)
    tokens = tokenizer.convert_ids_to_tokens(tokenized["input_ids"])
    word_ids = tokenized.word_ids()
    computed_mapped_to_ids = [computed[x] if x is not None else -100 for x in word_ids]


result = extract_entities(
    [
        "<e-start>generate</e-start> random words <e-statement>white hair, glasses, skirt</e-statement> and more random words"
    ],
    "generate_",
)


entities_vocab = list(entities_vocab)
entities_vocab.insert(0, "O")

original, computed = result[0]
computed = [entities_vocab.index(x) for x in computed.split(" ")]
tokenized = tokenizer(original)
word_tokens = tokenizer.convert_ids_to_tokens(tokenized["input_ids"])
print(tokenized.tokens())
word_ids = tokenized.word_ids()
computed_mapped_to_ids = [computed[x] if x is not None else -100 for x in word_ids]

print(original, computed, word_ids, computed_mapped_to_ids)

# print(compute_entities(examples: ))
