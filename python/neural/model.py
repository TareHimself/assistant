import torch

from torch import nn, mm, Tensor
import torch.nn.functional as F


# class IntentsNeuralNet(nn.Module):
#     def __init__(self, vocab_dize, embed_dimensions, hidden_size, num_classes):
#         super().__init__()
#         self.em = nn.EmbeddingBag(vocab_dize, embed_dimensions, sparse=False)
#         self.fc1 = nn.Linear(embed_dimensions, hidden_size)
#         self.fc2 = nn.Linear(hidden_size, num_classes)

#     def forward(self, tokens: Tensor, offsets: Tensor):
#         x = self.em(tokens, offsets)
#         x = torch.tanh(self.fc1(x))
#         x = self.fc2(x)
#         return x


class IntentsNeuralNet(nn.Module):
    def __init__(self, vocab_dize, embed_dimensions, hidden_size, num_classes):
        super().__init__()
        # self.em = nn.EmbeddingBag(vocab_dize, embed_dimensions, sparse=False)
        self.lstm = nn.LSTM(embed_dimensions, hidden_size, batch_first=True)
        self.fc1 = nn.Linear(hidden_size, num_classes)

    def forward(self, tokens: Tensor):
        x = self.em(tokens)
        # print(x.shape)
        # _, (ht, ct) = self.lstm(x)
        # print(ht.shape, ct.shape, _.shape)
        # x = ht[-1]
        # print(x.shape)
        x = self.fc1(x)
        print(x.shape)
        return x
