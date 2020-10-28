# %pip install plotly

import plotly.graph_objects as go
import numpy as np

np.random.seed(1)

N = 100
random_x = np.linspace(0, 1, N)
random_y0 = np.random.randn(N) + 5
random_y1 = np.random.randn(N)
random_y2 = np.random.randn(N) - 5

fig = go.Figure()

# Add traces
fig.add_trace(go.Scatter(x=random_x, y=random_y0, mode="markers", name="markers"))
fig.add_trace(go.Scatter(x=random_x, y=random_y1, mode="lines+markers", name="lines+markers"))
fig.add_trace(go.Scatter(x=random_x, y=random_y2, mode="lines", name="lines"))

displayHTML(fig.to_html(full_html=False))


import plotly.express as px

df = px.data.iris()
fig2 = px.scatter(df, x="sepal_width", y="sepal_length", color="species")
displayHTML(fig2.to_html(full_html=False))

dbutils.secrets.get("dbjl-pytest", "pytest-key")[:-1]

