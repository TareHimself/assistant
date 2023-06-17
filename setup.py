from setuptools import setup, find_packages

setup(
    name="assistant_python",
    version="1.0.0",
    author="TareHimself",
    description="A voice assistant",
    packages=find_packages(),
    install_requires=[
        "dependency1",
        "dependency2>=1.0.0",
        "dependency3<2.0.0",
    ],
)
