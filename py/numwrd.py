import math
from typing import Union

words_to_num = {
    "zero": 0,
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
    "eleven": 11,
    "twelve": 12,
    "thirteen": 13,
    "fourteen": 14,
    "fifteen": 15,
    "sixteen": 16,
    "seventeen": 17,
    "eighteen": 18,
    "nineteen": 19,
    "twenty": 20,
    "thirty": 30,
    "forty": 40,
    "fifty": 50,
    "sixty": 60,
    "seventy": 70,
    "eighty": 80,
    "ninety": 90,
}

num_to_words = {
    "0": "zero",
    "1": "one",
    "2": "two",
    "3": "three",
    "4": "four",
    "5": "five",
    "6": "six",
    "7": "seven",
    "8": "eight",
    "9": "nine",
    "10": "ten",
    "11": "eleven",
    "12": "twelve",
    "13": "thirteen",
    "14": "fourteen",
    "15": "fifteen",
    "16": "sixteen",
    "17": "seventeen",
    "18": "eighteen",
    "19": "nineteen",
    "20": "twenty",
    "30": "thirty",
    "40": "forty",
    "50": "fifty",
    "60": "sixty",
    "70": "seventy",
    "80": "eighty",
    "90": "ninety",
}

words_to_num_operators = {
    "hundred": 100,
    "thousand": 1000,
    "million": 1000000,
    "billion": 1000000000,
    "trillion": 1000000000000,
    "quadrillion": 1000000000000000
}

num_to_words_operators = {
    0: "",
    1: "thousand",
    2: "million",
    3: "billion",
    4: "trillion",
    5: "quadrillion"
}


def wrd2num(words: str):
    temp = 0
    num_operations = 0
    items = []
    lastNum = math.inf
    words = words.strip().lower().replace(',', "").split('point')
    non_fractional = words[0]
    fractional = (words[1] if len(words) > 1 else "").strip()
    fractional = fractional if len(fractional) > 0 else None
    if non_fractional.isdigit() and fractional is None:
        return float(non_fractional)
    elif fractional is not None and f"{non_fractional}.{fractional}".isdigit():
        return float(f"{non_fractional}.{fractional}")

    for word in non_fractional.split():
        if word in words_to_num_operators.keys():
            if temp == 0 and len(items) > 0:
                items[0] = items[0] * words_to_num_operators[word]
            else:
                temp = temp * words_to_num_operators[word]
                items.insert(0, temp)
                temp = 0
                lastNum = math.inf
            num_operations += 1
        elif word in words_to_num.keys():
            if lastNum < words_to_num[word]:
                return None

            temp = temp + words_to_num[word]
            lastNum = words_to_num[word]
            num_operations += 1
        else:
            return None
    if num_operations == 0:
        return None

    if temp != 0:
        items.insert(0, temp)
        temp = 0

    if fractional is not None:
        total = ""
        for num in fractional.split():
            if num in words_to_num.keys() and words_to_num[num] < 10:
                total += f"{words_to_num[num]}"
            else:
                return None

        total = (1 / (10 ** len(total))) * float(total)
        items.append(total)

    items.reverse()

    return sum(items)


def num2wrd(num: Union[float, int]):
    if num == 0:
        return "zero"
    result = ''
    parts = []
    num_as_wrd = str(num).split('.')

    non_fractional = num_as_wrd[0]

    fractional = (num_as_wrd[1] if len(num_as_wrd) > 1 else "").strip()

    fractional = fractional if len(fractional.rstrip("0")) > 0 else None

    for i in range(math.ceil(len(non_fractional) / 3)):
        parts.insert(0, non_fractional[::-1][3 * i:(3 * i) + 3][::-1])

    for i in range(len(parts)):
        section = parts[i]
        section_result = ''
        section_position = len(parts) - 1 - i

        suffix = num_to_words_operators[section_position]

        for x in range(len(section)):
            num_current = section[x]
            num_position = len(section) - 1 - x

            if num_position == 2 and num_current != "0":
                section_result = section_result + \
                    num_to_words[num_current] + " hundred "
            elif num_position == 1 and num_current != "0":
                if num_current == "1" and section[x + 1] != "0":
                    section_result = section_result + \
                        num_to_words[num_current + section[x + 1]] + " "
                    break
                else:
                    section_result = section_result + \
                        num_to_words[num_current + "0"] + " "
            elif num_position == 0 and num_current != "0":
                section_result = section_result + \
                    num_to_words[num_current] + " "

        if section_result:
            section_result = section_result + suffix + " "

        result = result + section_result

    result = result.strip()

    if fractional is not None:
        result += " point"
        for tok in fractional:
            result += f" {num_to_words[tok]}"

    return result


def allTextToDigits(expr: str):
    all_tok = expr.split()
    word_buff = []
    result = ""

    for tok in all_tok:
        word_buff.append(f"{tok} ")
        possible_num = wrd2num("".join(word_buff))

        if possible_num is not None:
            continue
        else:
            failed = word_buff.pop()
            if len(word_buff) > 0:
                result += f"{wrd2num(''.join(word_buff))} "
                word_buff = []
            possible_num_failed = wrd2num(failed)

            if possible_num_failed is not None:
                word_buff.append(f"{failed} ")
            else:
                result += failed

    if len(word_buff) > 0:
        result += f"{wrd2num(''.join(word_buff))} "
        word_buff = []

    return result


def allDigitsToText(expr: str):
    all_tok = expr
    result = ""
    buff = ""
    for tok in all_tok:
        if (tok + buff).replace('.', '').replace(',', "").isdigit():
            buff += tok
        else:
            if len(buff) > 0:
                result += f"{num2wrd(buff.replace(',', ''))}"
                buff = ""
            result += f"{tok}"

    if len(buff) > 0:
        result += f"{num2wrd(buff.replace(',', ''))}"
        buff = ""

    return result.strip()
