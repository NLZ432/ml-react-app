import argparse

import cv2
import numpy as np
from time import time
import tflite_runtime.interpreter as tflite
import parse_hyperparams
import tarfile
from PIL import Image
import collections

from mjpegstreamer import MJPEGServer
from pbtxt import PBTXTParser


def test_video(directory, video_path, interpreter, labels):
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()
    frames = 0
    height = input_details[0]['shape'][1]
    width = input_details[0]['shape'][2]

    video = cv2.VideoCapture(video_path)
    image_width = video.get(cv2.CAP_PROP_FRAME_WIDTH)
    image_height = video.get(cv2.CAP_PROP_FRAME_HEIGHT)
    fps = video.get(cv2.CAP_PROP_FPS)
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(join(directory, "inference.mp4"), fourcc, fps, (int(image_width), int(image_height)))

    server = MJPEGServer(image_width, image_height)
    server.start()
    o_scale, o_mean = output_details[1]['quantization']

    print("MJPEG server started")
    while video.isOpened():
        start = time()
        # Acquire frame and resize to expected shape [1xHxWx3]
        ret, frame = video.read()
        if not ret:
            break
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        frame_resized = cv2.resize(frame_rgb, (width, height))
        input_data = np.expand_dims(frame_resized, axis=0)

        # Perform the actual detection by running the model with the image as input
        interpreter.set_tensor(input_details[0]['index'], input_data)
        interpreter.invoke()

        # Retrieve detection results
        boxes = interpreter.get_tensor(output_details[0]['index'])
        scores = interpreter.get_tensor(output_details[2]['index'])

        # Loop over all detections and draw detection box if confidence is above minimum threshold
        # print(boxes.shape[1])
        for i in range(boxes.shape[1]):
            if scores[0, i] > 0.5:
                # Get bounding box coordinates and draw box
                # Interpreter can return coordinates that are outside of image dimensions,
                # need to force them to be within image using max() and min()
                ymin = int(max(0, (boxes[0, i, 0] * image_height)))
                xmin = int(max(0, (boxes[0, i, 1] * image_width)))
                ymax = int(min(image_height, (boxes[0, i, 2] * image_height)))
                xmax = int(min(image_width, (boxes[0, i, 3] * image_width)))
                cv2.rectangle(frame, (xmin, ymin), (xmax, ymax), (10, 255, 0), 4)

                # Draw label
                # Look up object name from "labels" array using class index
                object_name = labels[int(classes[i].item())]
                label = '%s: %d%%' % (object_name, int(scores[0, i].item() * 100))  # Example: 'person: 72%'
                label_size, base = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)  # Get font size
                label_ymin = max(ymin, label_size[1] + 10)  # Make sure not to draw label too close to top of window
                cv2.rectangle(frame, (xmin, label_ymin - label_size[1] - 10),
                              (xmin + label_size[0], label_ymin + base - 10),
                              (255, 255, 255), cv2.FILLED)  # Draw white box to put label text in
                # Draw label text
                cv2.putText(frame, label, (xmin, label_ymin - 7), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
            else:
                break

    def scale(self, sx, sy):
        """Returns scaled bounding box."""
        return BBox(xmin=sx * self.xmin,
                    ymin=sy * self.ymin,
                    xmax=sx * self.xmax,
                    ymax=sy * self.ymax)



class Tester:
    def __init__(self, model_dir):
        data = parse_hyperparams.parse(model_dir + "/testparameters.json")
        output_vid_path = data["output-vid-path"]
        self.video_path = data["test-video"]
        model_path = data["model-tar"]
        tar = tarfile.open(model_path)
        tar.extractall("/tensorflow/models/research/")

        self.interpreter = tflite.Interpreter(model_path="/tensorflow/models/research/unoptimized.tflite")

        parser = PBTXTParser("/tensorflow/models/research/map.pbtxt")
        parser.parse()
        self.labels = parser.file

        self.input_video = cv2.VideoCapture(self.video_path)
        width = self.input_video.get(cv2.CAP_PROP_FRAME_WIDTH)
        height = self.input_video.get(cv2.CAP_PROP_FRAME_HEIGHT)
        fps = self.input_video.get(cv2.CAP_PROP_FPS)
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        self.output_video = cv2.VideoWriter(output_vid_path, fourcc, fps, (int(width), int(height)))
        self.server = MJPEGServer(300, 300)

        self.frames = 0

    def run(self):
        self.server.start()
        print("MJPEG server started")

        self.interpreter.allocate_tensors()

        while self.input_video.isOpened():
            start = time()
            # Acquire frame and resize to expected shape [1xHxWx3]
            ret, frame = self.input_video.read()
            if not ret:
                break

            # input
            frame_cv2 = frame
            frame = Image.fromarray(frame_cv2)
            scale = self.set_input(frame)

            # run inference
            self.interpreter.invoke()

            # output
            boxes, class_ids, scores, x_scale, y_scale = self.get_output(scale)
            for i in range(len(boxes)):
                if scores[i] > .5:

                    class_id = class_ids[i];
                    if (np.isnan(class_id)):
                        continue

                    class_id = int(class_id);
                    if (class_id not in range(len(self.labels))):
                        continue
                    
                    frame_cv2 = self.label_frame(frame_cv2, self.labels[class_id], boxes[i], scores[i], x_scale, y_scale)
                    print("detection", end="\t");

            self.output_video.write(frame_cv2)
            self.server.set_image(frame_cv2)
            if self.frames % 1000 == 0:
                print("Completed", self.frames, "frames. FPS:", (1 / (time() - start)))
            self.frames += 1

        self.input_video.release()

    def label_frame(self, frame, object_name, box, score, x_scale, y_scale):
        ymin, xmin, ymax, xmax = box
        score = float(score)
        bbox = BBox(xmin=xmin,
                    ymin=ymin,
                    xmax=xmax,
                    ymax=ymax).scale(x_scale, y_scale)
        ymin, xmin, ymax, xmax = int(bbox.ymin), int(bbox.xmin), int(bbox.ymax), int(bbox.xmax)

        cv2.rectangle(frame, (xmin, ymin), (xmax, ymax), (10, 255, 0), 4)

        # Draw label
        # Look up object name from "labels" array using class index
        label = '%s: %d%%' % (object_name, score * 100)  # Example: 'person: 72%'
        label_size, base = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)  # Get font size
        label_ymin = max(ymin, label_size[1] + 10)  # Make sure not to draw label too close to top of window
        cv2.rectangle(frame, (xmin, label_ymin - label_size[1] - 10), (xmin + label_size[0], label_ymin + base - 10),
                      (255, 255, 255), cv2.FILLED)
        # Draw label text
        cv2.putText(frame, label, (xmin, label_ymin - 7), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
        return frame

    def input_size(self):
        """Returns input image size as (width, height) tuple."""
        _, height, width, _ = self.interpreter.get_input_details()[0]['shape']
        return width, height

    def set_input(self, frame):
        """Copies a resized and properly zero-padded image to the input tensor.
        Args:
          frame: image
        Returns:
          Actual resize ratio, which should be passed to `get_output` function.
        """
        width, height = self.input_size()
        w, h = frame.size
        new_img = np.reshape(frame.resize((300, 300)), (1, 300, 300, 3))
        self.interpreter.set_tensor(self.interpreter.get_input_details()[0]['index'], np.copy(new_img))
        return width/w, height/h

    def output_tensor(self, i):
        """Returns output tensor view."""
        tensor = self.interpreter.get_tensor(self.interpreter.get_output_details()[i]['index'])
        return np.squeeze(tensor)

    def get_output(self, scale):
        boxes = self.output_tensor(0)
        class_ids = self.output_tensor(1)
        scores = self.output_tensor(2)

        width, height = self.input_size()
        image_scale_x, image_scale_y = scale
        x_scale, y_scale = width / image_scale_x, height / image_scale_y
        return boxes, class_ids, scores, x_scale, y_scale


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--dir', type=str, help='Path of the folder to export in.')
    DIRECTORY = parser.parse_args().dir

    main(DIRECTORY)
