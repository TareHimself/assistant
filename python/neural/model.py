import torch

from torch import nn, mm, Tensor
import torch.nn.functional as F


class IntentsNeuralNet(nn.Module):
    def __init__(self, vocab_dize, embed_dimensions, hidden_size, num_classes):
        super().__init__()

        self.em = nn.EmbeddingBag(vocab_dize, embed_dimensions, sparse=False)
        self.fc = nn.Sequential(
            nn.Linear(embed_dimensions, hidden_size),
            nn.Dropout(0.4),
            nn.ReLU(),
            nn.Linear(hidden_size, hidden_size),
            nn.Dropout(0.4),
            nn.ReLU(),
            nn.Linear(hidden_size, hidden_size),
            nn.Dropout(0.4),
            nn.ReLU(),
            nn.Linear(hidden_size, hidden_size),
            nn.Dropout(0.4),
            nn.ReLU(),
            nn.Linear(hidden_size, num_classes)
        )

    def forward(self, tokens: Tensor, offsets: Tensor):
        x = self.em(tokens, offsets)
        x = self.fc(x)
        return x
