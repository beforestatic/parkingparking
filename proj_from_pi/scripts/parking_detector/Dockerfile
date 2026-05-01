FROM python:3.11-slim

WORKDIR /app

# opencv-python-headless avoids pulling in X11 libs
RUN pip install --no-cache-dir flask requests opencv-python-headless

COPY . .

EXPOSE 8000

CMD ["python", "gui_server.py", "--mode", "live"]
