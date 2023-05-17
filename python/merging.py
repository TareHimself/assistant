import time
from neural.utils import Vocabulary, split_text, expand_all_examples
from neural.datasets import IntentsDataset


# print(
#     [
#         Vocabulary.merge_pairs("an", [c for c in x])
#         for x in split_text("annabelle was my favorite doll.but now I have anne")
#     ]
# )

# print(
#     Vocabulary.get_most_freq_pair(
#         [
#             [c for c in x]
#             for x in split_text("annabelle was my favorite doll.but now I have anne")
#         ]
#     )
# )

import json

with open("./python/debug.json", "r") as f:
    data = json.load(f)
    all_examples = []
    for intent in data["intents"]:
        all_examples.extend(intent["examples"])

    IntentsDataset(expand_all_examples(data["intents"]))
    print("Building vocab")
    start_time = time.time()
    vocab = Vocabulary.to_vocab(all_examples, 2000)
    print(
        f"Done building vocab. took {time.time() - start_time} seconds to build vocab of size {len(vocab)}"
    )

    def test_vocab(text: str):
        global vocab
        tokenized = vocab(text)
        to_original = "".join(
            list(
                map(
                    lambda a: vocab.inv_vocab[a]
                    if vocab.inv_vocab[a] != Vocabulary.RESERVED_KEY_WHITESPACE
                    else " ",
                    tokenized,
                )
            )
        )
        print("\n")
        print(
            f"TEST {'FAILED' if text.strip() != to_original else 'PASSED'} | Converted to {len(tokenized)} Tokens\n"
            f"ORIGINAL:  {text}\nTOKENIZED:",
            to_original,
        )
        print("\n")

    test_vocab(
        "generate (best quality, masterpiece), 1girl, particle, wind, flower, upper body, dark simple background, looking at viewer, blonde, galaxy <params:size:512x1024> <params:control:8> <params:steps:25>"
    )
    test_vocab("today is a good day")
    test_vocab("oyintare ebelo")
    test_vocab("two plus two is four minus one thats three quick maths")
    test_vocab("Lorem ipsum dolor sit amet, consectetur adipiscing elit.")
    test_vocab(
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer nec tincidunt diam. Quisque in sapien lacinia, rhoncus ligula sed, convallis lectus. Duis at justo augue. Ut eu vestibulum orci. Suspendisse interdum enim in metus luctus, vel rutrum urna sollicitudin. Vestibulum at sapien ac nisl efficitur volutpat. Nam gravida auctor risus non vestibulum. Vivamus ullamcorper cursus magna, sed interdum nisl euismod et. In eget lectus quis elit lobortis euismod. Sed dignissim felis at sem cursus ultrices. Nunc eleifend bibendum sapien, id gravida metus dignissim sed. Sed vel finibus massa, id convallis dolor. Morbi ut leo ut sem feugiat vulputate. Sed quis nunc vitae magna accumsan tincidunt. Nulla facilisi."
    )

    with open("vocab_dump.json", "w") as vd:
        json.dump(vocab.vocab, vd, indent=2)
