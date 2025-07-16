import cv2
import os
import numpy as np
from datetime import datetime
import sqlite3
import dlib
from sklearn.preprocessing import LabelEncoder
from sklearn.svm import SVC
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

if len(sys.argv) > 1:
    user_email = sys.argv[1]
    print(f"Face recognition started for: {user_email}")
else:
    user_email = None
CASCADE_PATH = os.path.join(BASE_DIR, "haarcascade_frontalface_default.xml")
PREDICTOR_PATH = os.path.join(BASE_DIR, "shape_predictor_68_face_landmarks.dat")


face_cascade = cv2.CascadeClassifier(CASCADE_PATH)
predictor = dlib.shape_predictor(PREDICTOR_PATH)

dataset_path = os.path.join(os.path.dirname(__file__), "dataset")
images = []
labels = []


for image_path in os.listdir(dataset_path):
  
    image = cv2.imread(os.path.join(dataset_path, image_path))
    
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5)
   
    for (x, y, w, h) in faces:
       
        face = gray[y:y+h, x:x+w]
       
        face = cv2.resize(face, (128, 128))
       
        landmarks = predictor(face, dlib.rectangle(0, 0, 128, 128))
       
        features = np.array([[point.x, point.y] for point in landmarks.parts()])
        
        images.append(features.flatten())
        labels.append(image_path.split(".")[0])


le = LabelEncoder()
labels = le.fit_transform(labels)


model = SVC(kernel="linear", probability=True)


model.fit(images, labels)


cap = cv2.VideoCapture(0)

while True:
   
    ret, frame = cap.read()
    
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
   
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5)
    
    for (x, y, w, h) in faces:
                   
        face = gray[y:y+h, x:x+w]
       
        face = cv2.resize(face, (128, 128))
        
        landmarks = predictor(face, dlib.rectangle(0, 0, 128, 128))
       
        features = np.array([[point.x, point.y] for point in landmarks.parts()])
       
        label = model.predict(features.flatten().reshape(1, -1))
     
        label = le.inverse_transform(label)[0]
        
        cv2.rectangle(frame, (x, y), (x+w, y+h), (255, 0, 0), 2)
       
        cv2.putText(frame, label, (x, y-10), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 0, 0), 2)
   
    cv2.imshow("Webcam", frame)
   
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break


cap.release()
cv2.destroyAllWindows()


connection = sqlite3.connect("attendance.db")
cursor = connection.cursor()
    
cursor.execute("CREATE TABLE IF NOT EXISTS attendance (student TEXT, date TEXT)")
    
for label in labels:
    cursor.execute("INSERT INTO attendance VALUES (?, ?)", (label, str(datetime.now())))
    
connection.commit()
connection.close()
