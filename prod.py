from fractions import Fraction
import numpy as np

y = np.array([1, -1, 1, 19])

vecs = [[1, -1, -1, 1], [-1, 1, 0, 2]]

vecs = [np.array(v) for v in vecs]


def computePart(vec: np.ndarray, y: np.ndarray):
    return (np.dot(y, vec) / (np.dot(vec, vec))) * vec


def computeY(vectors: list[np.ndarray], y: np.ndarray):
    computed = [computePart(x, y) for x in vectors]
    return np.sum(computed, axis=0)


def to_fractions(vec: np.ndarray):
    return [str(Fraction(x).limit_denominator(100)) for x in vec]


def do_length(vecs: np.ndarray):
    return sum(list(map(lambda a: a * a, vecs)))


print(
    to_fractions(computeY(vecs, y)),
    to_fractions(y - computeY(vecs, y)),
    Fraction(do_length(y - computeY(vecs, y))).limit_denominator(100),
)
