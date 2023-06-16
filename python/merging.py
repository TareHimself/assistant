import time
from neural.utils import Vocabulary, split_text, expand_all_examples
from neural.engines import NEREngine
from neural.train import train_ner

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

print(
    NEREngine(
        [
            {
                "tag": "gen",
                "examples": [
                    "[G|g]enerate <e-prompt>microphone</e-prompt>",
                    "[G|g]enerate <e-prompt>mask, school</e-prompt>",
                    "[G|g]enerate <e-prompt>a man with a big jaw <params:size:50x10> <params:seed:711169780></e-prompt>",
                    "[G|g]enerate <e-prompt>(masterpiece), (visible face), a black man wearing golden gucci</e-prompt>",
                    "[G|g]enerate <e-prompt>school</e-prompt>",
                    "[G|g]enerate <e-prompt>a purp dank</e-prompt>",
                    "[G|g]enerate <e-prompt>[white hair | blue eyes | dress | pink lips ], [skirt |  skin]</e-prompt>",
                    "[G|g]enerate <e-prompt>red trees, two tables</e-prompt>",
                    "[G|g]enerate <e-prompt>a man with a red and blue hay</e-prompt>",
                    "[G|g]enerate <e-prompt>three little pigs playing on the beach</e-prompt>",
                    "[G|g]enerate <e-prompt>( ninja ), shuriken, , stealth, ( assassin )</e-prompt>",
                    "[G|g]enerate <e-prompt>chef, apron, spatula</e-prompt>",
                    "[G|g]enerate <e-prompt>wizard, hat, spells, magic</e-prompt>",
                    "[G|g]enerate <e-prompt>pirate, eyepatch, , peg leg</e-prompt>",
                    "[G|g]enerate <e-prompt>(vampire), coffin, ( cape), blood</e-prompt>",
                    "[G|g]enerate <e-prompt>micheal jackson in a blue bugatti</e-prompt>",
                    "[G|g]enerate <e-prompt>cowboy, hat, spurs, lasso</e-prompt>",
                    "[G|g]enerate <e-prompt>spy, briefcase, stealth, espionage</e-prompt>",
                    "[G|g]enerate <e-prompt>(musician), guitar, stage, performance</e-prompt>",
                    "[G|g]enerate <e-prompt>ancient temple, man, archeologist, fedora hat, brown leather jacket</e-prompt>",
                    "[G|g]enerate <e-prompt>mystical garden, woman, druid, green dress, long brown hair</e-prompt>",
                    "[G|g]enerate <e-prompt>jungle scene, man, explorer, pith helmet, khaki shirt</e-prompt>",
                    "[G|g]enerate <e-prompt>(best quality, masterpiece), 1girl, particle, wind, flower, upper body, dark simple background, looking at viewer, blonde, galaxy <params:size:504x1009> <params:seed:736669780> <params:control:8> <params:steps:25></e-prompt>",
                ],
            }
        ],
        "test.pt",
    )
    .ready()
    .get_entities("generate microphone")
)
# train_ner(
#    ,
# )

# dataset = NERDataset(
#     [
#         {
#             "tag": "knocks",
#             "examples": [
#                 "<e-person>Tare Ebelo</e-person> is a person",
#                 "my friend is <e-person>Emi Ebelo</e-person>",
#                 "please call <e-person>Allison</e-person>, I need her now",
#                 "<e-person>Micheal</e-person> whats up ?",
#             ],
#         }
#     ]
# )

# print("ROW", dataset[0])
