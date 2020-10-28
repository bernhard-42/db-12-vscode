# %pip install  /dbfs/home/ < replace with user name > /test_pipeline-0.1-py3-none-any.whl Faker tqdm

#
# Use to get local code completion
#
from pyspark.sql import SparkSession

spark = SparkSession.builder.getOrCreate()
sc = spark.sparkContext

#
# main
#

from test_pipeline import square, cube, half, times3, birth_year
import pandas as pd
from faker import Faker
import random
import pyspark.sql.functions as F

h = half(a)
s = square(a)
t = times3(a)
print(h)
print(s)
print(t)

x = sc.range(0, 20).map(times3).collect()

f = Faker("de_de")
pdf = pd.DataFrame(
    [{"name": f.name(), "address": f.address(), "age": random.randint(10, 80)} for i in range(10)]
)
display(pdf)


#
# watch demos
#

from tqdm import tqdm
import time
import sys

#%watch
for i in tqdm(range(10)):
    time.sleep(1)
#%unwatch

#
# Demo for hierarchical variable browser
#

c = {
    "order_id": 1,
    "name": "Irma Reuter",
    "sku": 32685,
    "price": 74.18,
    "shipTo": {
        "name": "Irma Reuter",
        "address": "Koch IIstr. 193",
        "city": "D\u00f6beln",
        "state": "Th\u00fcringen",
        "zip": "11136",
    },
    "billTo": {
        "name": "Irma Reuter",
        "address": "Koch IIstr. 193",
        "city": "D\u00f6beln",
        "state": "Th\u00fcringen",
        "zip": "11136",
    },
}
c
