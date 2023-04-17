import re

TOKENIZE_REGEX = r"[A-Za-z0-9!]+|[\"#$%&'()*+,\-.\/:;<=>?@\[\\\]^_`{|}~]+"
ENTITIES_REGEX = r"<e-([a-z_]+)>(.+?)<\/e-\1>"


def split_text(text: str):
    print(text, re.findall(TOKENIZE_REGEX, text))
    return re.findall(TOKENIZE_REGEX, text)


def extract_entities(examples: list, prefix=''):
    computed = []
    all_entities = set()
    for example in examples:
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

            # find the index of the entity in the example
            target_index = remaining.index(entity_example)

            # cut out said entity
            to_tag = remaining[target_index:target_index+len(entity_example)]

            # ensure we have entires in the vocab
            all_entities.add(f"B-{prefix}{entity}")
            all_entities.add(f"I-{prefix}{entity}")
            print(to_tag)
            # tag each word in the entity
            tagged = " ".join([f"B-{prefix}{entity}" if i ==
                               0 else f"I-{prefix}{entity}" for i in range(len(split_text(to_tag)))])

            # tag all the previous words with the 'O' tag
            before_entities = " ".join(['O' for x in split_text(
                remaining[0:target_index])])

            # combine the previous data and the currently tagged entities
            entity_tags += " " + before_entities + " " + tagged
            entity_tags.strip()

            remaining = remaining[target_index +
                                  len(entity_example):len(remaining)]

        if len(remaining) > 0:
            entity_tags += " " + " ".join(['O' for x in split_text(
                remaining[0:len(remaining)])])
        computed.append((split_text(new_example), entity_tags.strip().split()))

    return (all_entities, computed)


print("REGEX", extract_entities(
    ['<e-start>generate</e-start> <e-statement>white hair, glasses, skirt</e-statement>', 'generate <e-statement>white hair, glasses, ember skin</e-statement>', 'generate <e-statement>white hair, horns, skirt</e-statement>', 'generate <e-statement>white hair, horns, ember skin</e-statement>', 'generate <e-statement>white hair, purple eyes, skirt</e-statement>', 'generate <e-statement>white hair, purple eyes, ember skin</e-statement>', 'generate <e-statement>blue eyes, glasses, skirt</e-statement>', 'generate <e-statement>blue eyes, glasses, ember skin</e-statement>', 'generate <e-statement>blue eyes, horns, skirt</e-statement>', 'generate <e-statement>blue eyes, horns, ember skin</e-statement>', 'generate <e-statement>blue eyes, purple eyes, skirt</e-statement>', 'generate <e-statement>blue eyes, purple eyes, ember skin</e-statement>',
     'generate <e-statement>white dress, glasses, skirt</e-statement>', 'generate <e-statement>white dress, glasses, ember skin</e-statement>', 'generate <e-statement>white dress, horns, skirt</e-statement>', 'generate <e-statement>white dress, horns, ember skin</e-statement>', 'generate <e-statement>white dress, purple eyes, skirt</e-statement>', 'generate <e-statement>white dress, purple eyes, ember skin</e-statement>', 'generate <e-statement>pink lips, glasses, skirt</e-statement>', 'generate <e-statement>pink lips, glasses, ember skin</e-statement>', 'generate <e-statement>pink lips, horns, skirt</e-statement>', 'generate <e-statement>pink lips, horns, ember skin</e-statement>', 'generate <e-statement>pink lips, purple eyes, skirt</e-statement>', 'generate <e-statement>pink lips, purple eyes, ember skin</e-statement>.']))
