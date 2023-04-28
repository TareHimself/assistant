import torch

from torch import nn, mm, Tensor
import torch.nn.functional as F
from neural.utils import PYTORCH_DEVICE, Vocabulary, tokenize

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


# class IntentsNeuralNet(nn.Module):
#     def __init__(self, vocab: Vocabulary, embed_dimensions, hidden_size, classes):
#         super().__init__()
#         self.vocab = vocab
#         self.e_dim = embed_dimensions
#         self.h_size = hidden_size
#         self.classes = classes
#         self.device = torch.device('cpu')
#         self.em = nn.EmbeddingBag(len(self.vocab), self.e_dim, sparse=False)
#         self.fc = nn.Sequential(
#             nn.Linear(self.e_dim, self.h_size),
#             nn.ReLU(),
#             nn.Dropout(.3),
#             nn.Linear(self.h_size, self.h_size),
#             nn.ReLU(),
#             nn.Linear(self.h_size, len(self.classes)),
#             nn.Dropout(.3)
#         )

#     def forward(self, tokens: Tensor):

#         offset = None if len(tokens.shape) > 1 else torch.IntTensor(
#             [0]).to(self.device)

#         x = self.em(tokens, offset)

#         x = self.fc(x)

#         return x

#     def save(self, hash: str, path: str):
#         torch.save({
#             "state": self.state_dict(),
#             "vocab": self.vocab.vocab,
#             "e_dim": self.e_dim,
#             "h_size": self.h_size,
#             "classes": self.classes,
#             "hash": hash
#         }, path)

#     def predict(self, text: str):
#         sentence = tokenize(text)
#         x = self.vocab(sentence, 64)
#         x = torch.IntTensor(x)
#         output = self(x)
#         _, predicated = torch.max(output, dim=1)

#         probs = torch.softmax(output, dim=1)
#         prob = probs[0][predicated.item()]

#         all_classes = [{
#             "intent": self.classes[x],
#             "confidence": probs[0][x].item()
#         }
#             for x in range(len(self.classes))]

#         all_classes.sort(key=lambda a: a['confidence'], reverse=True)

#         return all_classes

#     @staticmethod
#     def load(path: str):
#         loaded_data = torch.load(path)
#         model = IntentsNeuralNet(Vocabulary(
#             loaded_data['vocab']), loaded_data['e_dim'], loaded_data['h_size'], loaded_data['classes'])
#         model.load_state_dict(loaded_data['state'])
#         return model

#     def to_device(self, d):
#         return self.to(d)


class IntentsNeuralNet(nn.Module):
    def __init__(self, vocab: Vocabulary, embed_dimensions, hidden_size, classes):
        super().__init__()
        self.vocab = vocab
        self.e_dim = embed_dimensions
        self.h_size = hidden_size
        self.classes = classes
        self.device = torch.device('cpu')
        self.em = nn.EmbeddingBag(len(self.vocab), self.e_dim, sparse=False)
        self.lstm = nn.LSTM(input_size=self.e_dim,
                            hidden_size=self.h_size, num_layers=5, dropout=0.3)
        self.fc1 = nn.Linear(self.h_size, len(self.classes))

    def forward(self, tokens: Tensor):

        offset = None if len(tokens.shape) > 1 else torch.IntTensor(
            [0]).to(self.device)

        x = self.em(tokens, offset)

        x, _ = self.lstm(x)

        x = self.fc1(x)

        return x

    def save(self, hash: str, path: str):
        torch.save({
            "state": self.state_dict(),
            "vocab": self.vocab.vocab,
            "e_dim": self.e_dim,
            "h_size": self.h_size,
            "classes": self.classes,
            "hash": hash
        }, path)

    def predict(self, text: str):
        sentence = tokenize(text)
        x = self.vocab(sentence, 64)
        x = torch.IntTensor(x)
        output = self(x)
        print(output)
        _, predicated = torch.max(output, dim=1)

        probs = torch.softmax(output, dim=1)
        prob = probs[0][predicated.item()]

        print(probs)
        all_classes = [{
            "intent": self.classes[x],
            "confidence": probs[0][x].item()
        }
            for x in range(len(self.classes))]

        all_classes.sort(key=lambda a: a['confidence'], reverse=True)

        return all_classes

    @staticmethod
    def load(path: str):
        loaded_data = torch.load(path)
        model = IntentsNeuralNet(Vocabulary(
            loaded_data['vocab']), loaded_data['e_dim'], loaded_data['h_size'], loaded_data['classes'])
        model.load_state_dict(loaded_data['state'])
        return model

    def to_device(self, d):
        return self.to(d)


class TokenClassificationNet(nn.Module):
    def __init__(self, vocab_size, embed_dimensions, hidden_size, num_classes):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, embed_dimensions)
        self.fc1 = nn.Linear(embed_dimensions, hidden_size)
        self.fc2 = nn.Linear(hidden_size, num_classes)

    def forward(self, tokens: Tensor):
        # tokens: batch_size x sequence_length
        # batch_size x sequence_length x embed_dimensions
        embedded = self.embedding(tokens)
        # (batch_size * sequence_length) x embed_dimensions
        embedded = embedded.view(-1, embedded.size(2))
        # (batch_size * sequence_length) x hidden_size
        x = F.relu(self.fc1(embedded))
        x = self.fc2(x)  # (batch_size * sequence_length) x num_classes
        # batch_size x sequence_length x num_classes
        x = x.view(-1, tokens.size(1), x.size(1))
        return x
