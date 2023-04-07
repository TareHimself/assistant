import torch
from neural.utils import EMBEDDINGS_MODEL
from transformers import BertModel,DistilBertModel
from torch import nn, mm, Tensor
import torch.nn.functional as F


# class IntentsNeuralNet(nn.Module):
#     def __init__(self, hidden_size, num_classes):
#         super().__init__()

#         self.em = BertModel.from_pretrained(EMBEDDINGS_MODEL)
#         self.fc = nn.Sequential(
#             nn.Dropout(0.5),
#             nn.Linear(768, num_classes),
#             nn.ReLU(),
#         )

#         # self.fc = nn.Sequential(
#         #     nn.Dropout(0.5),
#         #     nn.Linear(768, hidden_size),
#         #     nn.ReLU(),
#         #     nn.Dropout(0.5),
#         #     nn.Linear(hidden_size, num_classes),
#         #     nn.ReLU()
#         # )

#     def forward(self, input_id, mask):
#         _, pooled_output = self.em(
#             input_ids=input_id, attention_mask=mask, return_dict=False)

#         x = self.fc(pooled_output)

#         return x
    

class IntentsNeuralNet(nn.Module):
    def __init__(self, hidden_size, num_classes):
        super().__init__()

        self.em = DistilBertModel.from_pretrained(EMBEDDINGS_MODEL)
        self.fc = nn.Sequential(
            nn.Dropout(0.4),
            nn.Linear(768, num_classes),
            nn.ReLU(),
        )

    def forward(self, input_ids, mask):
        distilbert_output = self.em(input_ids=input_ids, attention_mask=mask)
        hidden_state = distilbert_output[0]
        pooled_output = hidden_state[:, 0]

        x = self.fc(pooled_output)

        return x
