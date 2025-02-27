// App.js

import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as posenet from '@tensorflow-models/posenet';
import '@tensorflow/tfjs';
import './App.css';

function App() {
  // Model and webcam state
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [poseNetModel, setPoseNetModel] = useState(null);
  const [isWebcamEnabled, setIsWebcamEnabled] = useState(false);
  const [isWebcamLoaded, setIsWebcamLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Posture analysis state
  const [postureStatus, setPostureStatus] = useState('neutral'); // 'good', 'bad', 'warning', 'neutral'
  const [postureScore, setPostureScore] = useState(100);
  const [postureFeedback, setPostureFeedback] = useState('Calibrate your posture to begin analysis.');
  const [calibratedPosture, setCalibratedPosture] = useState(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [showReferenceLines, setShowReferenceLines] = useState(true);

  // Settings state
  const [sensitivityLevel, setSensitivityLevel] = useState(2); // 1-3 (low to high)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isReminderEnabled, setIsReminderEnabled] = useState(true);
  const [reminderInterval, setReminderInterval] = useState(20); // minutes
  const [showSettings, setShowSettings] = useState(false);

  // Stats state
  const [stats, setStats] = useState({
    goodPostureTime: 0,
    badPostureTime: 0,
    currentGoodTime: 0,
    currentBadTime: 0,
    sessionsCount: 0,
    lastSession: null,
  });

  // Notification state
  const [notification, setNotification] = useState(null);

  // Refs
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const detectionIntervalRef = useRef(null);
  const reminderTimeoutRef = useRef(null);
  const statsIntervalRef = useRef(null);
  const lastPostureUpdateRef = useRef(Date.now());
  const audioRef = useRef(new Audio('data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA/+M4wAAAAAAAAAAAAEluZm8AAAAPAAAAAwAAAbAASEhISEhISEhISEhISEhISEhISEhISEhIf39/f39/f39/f39/f39/f39/f39/f39/f3+AgICAgICAgICAgICAgICAgICAgICAgICAgKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKAAAABMYXZjNTguMTM0AAAAAAAAAAAAAAD/4ziMAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAADAAACdQCZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZm0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMwAAABMYXZjNTguMjAAAAAAAAAAAAAAAAD/81TAAAAAGAAAAADAAAEAADM0AAABAAABsBvqwDQEAAAATEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zUsBDAAG0AH+AAAIAAAP4AAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV'));

  // Constants
  const confidenceThreshold = 0.5;
  const detectionFrequency = 100; // ms
  
  const sensitivitySettings = {
    1: { // Low 
      shoulderThreshold: 15,
      neckThreshold: 20
    },
    2: { // Medium
      shoulderThreshold: 10,
      neckThreshold: 15
    },
    3: { // High
      shoulderThreshold: 5,
      neckThreshold: 10
    }
  };

  // Load PoseNet model
  useEffect(() => {
    async function loadPoseNetModel() {
      try {
        setIsModelLoading(true);
        const loadedModel = await posenet.load({
          architecture: 'MobileNetV1',
          outputStride: 16,
          inputResolution: { width: 640, height: 480 },
          multiplier: 0.75,
          quantBytes: 2
        });
        
        setPoseNetModel(loadedModel);
        setIsModelLoading(false);
        showNotification('success', 'PoseNet model loaded successfully!');
      } catch (error) {
        console.error('Error loading PoseNet model:', error);
        setErrorMessage('Failed to load posture detection model. Please refresh the page and try again.');
        showNotification('error', 'Failed to load posture detection model.');
        setIsModelLoading(false);
      }
    }
    
    loadPoseNetModel();
    
    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
      if (reminderTimeoutRef.current) {
        clearTimeout(reminderTimeoutRef.current);
      }
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }
    };
  }, []);

  // Load stats from localStorage
  useEffect(() => {
    try {
      const savedStats = localStorage.getItem('postureStats');
      if (savedStats) {
        const parsedStats = JSON.parse(savedStats);
        setStats(prevStats => ({
          ...prevStats,
          goodPostureTime: parsedStats.goodPostureTime || 0,
          badPostureTime: parsedStats.badPostureTime || 0,
          sessionsCount: parsedStats.sessionsCount || 0,
          lastSession: parsedStats.lastSession || null
        }));
      }
    } catch (e) {
      console.log('Could not load stats from localStorage', e);
    }
  }, []);

  // Save stats to localStorage when they change
  useEffect(() => {
    if (stats.goodPostureTime > 0 || stats.badPostureTime > 0 || stats.sessionsCount > 0) {
      try {
        localStorage.setItem('postureStats', JSON.stringify({
          goodPostureTime: stats.goodPostureTime,
          badPostureTime: stats.badPostureTime,
          sessionsCount: stats.sessionsCount,
          lastSession: stats.lastSession
        }));
      } catch (e) {
        console.log('Could not save stats to localStorage', e);
      }
    }
  }, [stats]);

  // Handle window resize
  useEffect(() => {
    function handleResize() {
      adjustCanvasSize();
    }
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Setup webcam
  const setupWebcam = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMessage('Your browser does not support webcam access. Please try another browser.');
      showNotification('error', 'Your browser does not support webcam access.');
      return;
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false
      });
      
      if (webcamRef.current) {
        webcamRef.current.srcObject = stream;
        webcamRef.current.onloadedmetadata = () => {
          setIsWebcamLoaded(true);
          adjustCanvasSize();
          showNotification('success', 'Camera connected successfully!');
        };
      }
      
      setIsWebcamEnabled(true);
    } catch (error) {
      console.error('Error accessing webcam:', error);
      
      let message = 'Failed to access webcam.';
      if (error.name === 'NotAllowedError') {
        message = 'Camera access was denied. Please allow camera access and try again.';
      } else if (error.name === 'NotFoundError') {
        message = 'No camera detected. Please connect a camera and try again.';
      }
      
      setErrorMessage(message);
      showNotification('error', message);
    }
  };

  // Stop webcam
  const stopWebcam = () => {
    if (webcamRef.current && webcamRef.current.srcObject) {
      const tracks = webcamRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      webcamRef.current.srcObject = null;
      setIsWebcamEnabled(false);
      setIsWebcamLoaded(false);
      
      // Stop detection if it's running
      if (isDetecting) {
        stopPostureDetection();
      }
      
      // Clear canvas
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  };

  // Adjust canvas size
  const adjustCanvasSize = () => {
    if (!isWebcamLoaded || !webcamRef.current || !webcamRef.current.videoWidth) return;
    
    const videoWidth = webcamRef.current.videoWidth;
    const videoHeight = webcamRef.current.videoHeight;
    
    if (canvasRef.current) {
      canvasRef.current.width = videoWidth;
      canvasRef.current.height = videoHeight;
    }
  };

  // Calibrate posture
  const calibratePosture = async () => {
    if (!poseNetModel || !isWebcamEnabled || !isWebcamLoaded) {
      showNotification('warning', 'Please enable webcam first to calibrate your posture.');
      return;
    }
    
    try {
      showNotification('info', 'Sit with good posture for calibration...');
      
      // Delay a bit to allow user to get in position
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const pose = await detectPose();
      
      if (!pose) {
        showNotification('error', 'Could not detect your pose. Please make sure you are visible in the camera.');
        return;
      }
      
      // Extract key points for calibration
      const keypoints = extractKeyPosturePoints(pose);
      
      if (!isValidPoseForCalibration(keypoints)) {
        showNotification('warning', 'Could not detect key points clearly. Please adjust your position and try again.');
        return;
      }
      
      setCalibratedPosture(keypoints);
      showNotification('success', 'Posture calibrated successfully! Start monitoring to analyze your posture.');
      
      // Reset posture score after calibration
      setPostureScore(100);
      setPostureStatus('good');
      setPostureFeedback('Posture calibrated. Start monitoring to begin tracking.');
      
    } catch (error) {
      console.error('Error during calibration:', error);
      showNotification('error', 'Calibration failed. Please try again.');
    }
  };

  // Check if pose has all required keypoints for calibration
  const isValidPoseForCalibration = (keypoints) => {
    // Check if all required keypoints are present with sufficient confidence
    const requiredKeypoints = ['leftShoulder', 'rightShoulder', 'leftEar', 'rightEar', 'nose'];
    
    return requiredKeypoints.every(keypoint => 
      keypoints[keypoint] && keypoints[keypoint].confidence > confidenceThreshold
    );
  };

  // Extract key posture points from pose
  const extractKeyPosturePoints = (pose) => {
    const { keypoints } = pose;
    
    // Convert array of keypoints to object for easier access
    const keypointMap = {};
    keypoints.forEach(point => {
      keypointMap[point.part] = {
        x: point.position.x,
        y: point.position.y,
        confidence: point.score
      };
    });
    
    return keypointMap;
  };

  // Detect pose from webcam
  const detectPose = async () => {
    if (!poseNetModel || !webcamRef.current || !isWebcamLoaded) return null;
    
    try {
      const pose = await poseNetModel.estimateSinglePose(webcamRef.current, {
        flipHorizontal: true
      });
      
      return pose;
    } catch (error) {
      console.error('Error detecting pose:', error);
      return null;
    }
  };

  // Start posture detection
  const startPostureDetection = () => {
    if (!poseNetModel || !isWebcamEnabled || !isWebcamLoaded) {
      showNotification('warning', 'Please enable webcam first to start posture detection.');
      return;
    }
    
    if (!calibratedPosture) {
      showNotification('warning', 'Please calibrate your posture first before starting detection.');
      return;
    }
    
    setIsDetecting(true);
    
    // Start detection interval
    detectionIntervalRef.current = setInterval(async () => {
      const pose = await detectPose();
      
      if (pose) {
        analyzePose(pose);
        drawPose(pose);
      }
    }, detectionFrequency);
    
    // Start stats update interval
    statsIntervalRef.current = setInterval(() => {
      setStats(prevStats => ({
        ...prevStats
      }));
    }, 1000);
    
    // Increment sessions count
    setStats(prevStats => ({
      ...prevStats,
      sessionsCount: prevStats.sessionsCount + 1,
      lastSession: new Date().toISOString()
    }));
    
    // Set reminder timeout if enabled
    if (isReminderEnabled) {
      setReminderTimeout();
    }
    
    showNotification('success', 'Posture monitoring started!');
  };

  // Stop posture detection
  const stopPostureDetection = () => {
    setIsDetecting(false);
    
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
    
    if (reminderTimeoutRef.current) {
      clearTimeout(reminderTimeoutRef.current);
      reminderTimeoutRef.current = null;
    }
    
    // Update total time stats
    setStats(prevStats => ({
      ...prevStats,
      goodPostureTime: prevStats.goodPostureTime + prevStats.currentGoodTime,
      badPostureTime: prevStats.badPostureTime + prevStats.currentBadTime,
      currentGoodTime: 0,
      currentBadTime: 0
    }));
    
    // Clear canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    
    showNotification('info', 'Posture monitoring stopped.');
  };

  // Set reminder timeout
  const setReminderTimeout = () => {
    if (reminderTimeoutRef.current) {
      clearTimeout(reminderTimeoutRef.current);
    }
    
    reminderTimeoutRef.current = setTimeout(() => {
      if (isDetecting && isReminderEnabled) {
        showNotification('info', 'Posture check reminder: Take a moment to check your posture!');
        
        if (isAudioEnabled) {
          playNotificationSound();
        }
        
        // Set the next reminder
        setReminderTimeout();
      }
    }, reminderInterval * 60 * 1000); // Convert minutes to milliseconds
  };

  // Play notification sound
  const playNotificationSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(err => console.error('Error playing audio:', err));
    }
  };

  // Show notification
  const showNotification = (type, message) => {
    setNotification({ type, message, id: Date.now() });
    
    // Auto hide notification after 5 seconds
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  // Analyze pose and determine posture quality
  const analyzePose = (pose) => {
    if (!calibratedPosture) return;
    
    const currentKeypoints = extractKeyPosturePoints(pose);
    
    // Verify key points are detected with enough confidence
    if (!isValidPoseForCalibration(currentKeypoints)) {
      setPostureFeedback('Not all key points detected. Please adjust your position.');
      return;
    }
    
    // Calculate shoulder tilt
    const leftShoulder = currentKeypoints.leftShoulder;
    const rightShoulder = currentKeypoints.rightShoulder;
    const shoulderTiltAngle = Math.abs(Math.atan2(
      rightShoulder.y - leftShoulder.y,
      rightShoulder.x - leftShoulder.x
    ) * (180 / Math.PI));
    
    // Calculate neck tilt (using ears and nose)
    const leftEar = currentKeypoints.leftEar;
    const rightEar = currentKeypoints.rightEar;
    const nose = currentKeypoints.nose;
    
    // Calculate midpoint between ears
    const earMidpointX = (leftEar.x + rightEar.x) / 2;
    const earMidpointY = (leftEar.y + rightEar.y) / 2;
    
    // Calculate angle between vertical and nose-to-midpoint
    const neckTiltAngle = Math.abs(Math.atan2(
      nose.y - earMidpointY,
      nose.x - earMidpointX
    ) * (180 / Math.PI));
    
    // Get thresholds based on sensitivity
    const { shoulderThreshold, neckThreshold } = sensitivitySettings[sensitivityLevel];
    
    // Determine posture quality based on angles and thresholds
    let isGoodPosture = true;
    let feedback = '';
    
    if (shoulderTiltAngle > shoulderThreshold) {
      isGoodPosture = false;
      feedback = 'Shoulders are uneven. Try to level your shoulders.';
    }
    
    if (neckTiltAngle > neckThreshold) {
      isGoodPosture = false;
      feedback = feedback || 'Head is tilted. Try to keep your head centered.';
    }
    
    // Check vertical alignment between shoulders and ears
    const calibratedShoulderY = (calibratedPosture.leftShoulder.y + calibratedPosture.rightShoulder.y) / 2;
    const calibratedEarY = (calibratedPosture.leftEar.y + calibratedPosture.rightEar.y) / 2;
    const calibratedVerticalDiff = calibratedEarY - calibratedShoulderY;
    
    const currentShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
    const currentEarY = (leftEar.y + rightEar.y) / 2;
    const currentVerticalDiff = currentEarY - currentShoulderY;
    
    // Check if person is slouching (ears moved lower relative to shoulders)
    const verticalChangeThreshold = 20;
    const verticalChange = calibratedVerticalDiff - currentVerticalDiff;
    
    if (verticalChange > verticalChangeThreshold) {
      isGoodPosture = false;
      feedback = 'You appear to be slouching. Try sitting up straight.';
    }
    
    // Update posture status
    const now = Date.now();
    const timeDelta = (now - lastPostureUpdateRef.current) / 1000; // seconds
    lastPostureUpdateRef.current = now;
    
    // Update good/bad posture time
    if (isGoodPosture) {
      setStats(prevStats => ({
        ...prevStats,
        currentGoodTime: prevStats.currentGoodTime + timeDelta
      }));
      
      setPostureStatus('good');
      setPostureFeedback(feedback || 'Good posture! Keep it up!');
      
      // Gradually increase score if it's below max
      if (postureScore < 100) {
        setPostureScore(prev => Math.min(100, prev + 1));
      }
    } else {
      setStats(prevStats => ({
        ...prevStats,
        currentBadTime: prevStats.currentBadTime + timeDelta
      }));
      
      // Determine if it's warning or bad status based on score
      if (postureScore > 50) {
        setPostureStatus('warning');
      } else {
        setPostureStatus('bad');
        
        // Play sound alert for bad posture if enabled and not already at minimum score
        if (isAudioEnabled && postureScore > 20) {
          playNotificationSound();
        }
      }
      
      setPostureFeedback(feedback || 'Posture needs correction.');
      
      // Decrease score based on severity and sensitivity
      const decreaseAmount = Math.max(1, 3 * sensitivityLevel);
      setPostureScore(prev => Math.max(0, prev - decreaseAmount));
    }
  };

  // Draw pose on canvas
  const drawPose = (pose) => {
    if (!canvasRef.current || !webcamRef.current) return;
    
    const ctx = canvasRef.current.getContext('2d');
    const videoWidth = webcamRef.current.videoWidth;
    const videoHeight = webcamRef.current.videoHeight;
    
    // Set canvas dimensions to match video
    if (canvasRef.current.width !== videoWidth || canvasRef.current.height !== videoHeight) {
      canvasRef.current.width = videoWidth;
      canvasRef.current.height = videoHeight;
    }
    
    // Clear previous drawing
    ctx.clearRect(0, 0, videoWidth, videoHeight);
    
    if (!showReferenceLines) return;
    
    // Draw keypoints and connections
    const { keypoints } = pose;
    
    // Define connections to draw
    const connections = [
      ['leftShoulder', 'rightShoulder'],
      ['leftShoulder', 'leftElbow'],
      ['rightShoulder', 'rightElbow'],
      ['leftShoulder', 'leftHip'],
      ['rightShoulder', 'rightHip'],
      ['leftEar', 'leftShoulder'],
      ['rightEar', 'rightShoulder'],
      ['leftEar', 'leftEye'],
      ['rightEar', 'rightEye'],
      ['leftEye', 'nose'],
      ['rightEye', 'nose'],
    ];
    
    // Convert keypoints array to map for easier lookup
    const keypointMap = {};
    keypoints.forEach(keypoint => {
      keypointMap[keypoint.part] = keypoint;
    });
    
    // Draw connections
    ctx.lineWidth = 2;
    connections.forEach(([p1, p2]) => {
      const point1 = keypointMap[p1];
      const point2 = keypointMap[p2];
      
      if (point1 && point2 && point1.score > confidenceThreshold && point2.score > confidenceThreshold) {
        ctx.beginPath();
        ctx.moveTo(point1.position.x, point1.position.y);
        ctx.lineTo(point2.position.x, point2.position.y);
        
        // Color based on posture status
        if (postureStatus === 'good') {
          ctx.strokeStyle = '#34D399'; // Green
        } else if (postureStatus === 'warning') {
          ctx.strokeStyle = '#FBBF24'; // Yellow
        } else {
          ctx.strokeStyle = '#F87171'; // Red
        }
        
        ctx.stroke();
      }
    });
    
    // Draw keypoints
    keypoints.forEach(keypoint => {
      if (keypoint.score > confidenceThreshold) {
        ctx.beginPath();
        ctx.arc(keypoint.position.x, keypoint.position.y, 4, 0, 2 * Math.PI);
        
        // Color based on type of keypoint
        if (['nose', 'leftEye', 'rightEye', 'leftEar', 'rightEar'].includes(keypoint.part)) {
          ctx.fillStyle = '#5D5CDE'; // Primary color for face points
        } else {
          // Color based on posture status for body points
          if (postureStatus === 'good') {
            ctx.fillStyle = '#34D399'; // Green
          } else if (postureStatus === 'warning') {
            ctx.fillStyle = '#FBBF24'; // Yellow
          } else {
            ctx.fillStyle = '#F87171'; // Red
          }
        }
        
        ctx.fill();
      }
    });
    
    // Draw vertical reference line if calibrated
    if (calibratedPosture) {
      const nose = keypointMap.nose;
      if (nose && nose.score > confidenceThreshold) {
        const midShouldersX = (keypointMap.leftShoulder.position.x + keypointMap.rightShoulder.position.x) / 2;
        
        ctx.beginPath();
        ctx.moveTo(midShouldersX, 0);
        ctx.lineTo(midShouldersX, videoHeight);
        ctx.setLineDash([5, 5]); // Dashed line
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.7)'; // Gray with transparency
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  };

  // Format time (seconds to human-readable string)
  const formatTime = (seconds) => {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  // Format date
  const formatDate = (isoString) => {
    if (!isoString) return 'Never';
    try {
      return new Date(isoString).toLocaleString();
    } catch (e) {
      return 'Invalid date';
    }
  };

  // Calculate posture ratio
  const calculatePostureRatio = () => {
    const totalGoodTime = stats.goodPostureTime + stats.currentGoodTime;
    const totalBadTime = stats.badPostureTime + stats.currentBadTime;
    const totalTime = totalGoodTime + totalBadTime;
    
    if (totalTime === 0) return 0;
    return Math.round((totalGoodTime / totalTime) * 100);
  };

  // Toggle settings panel
  const toggleSettings = () => {
    setShowSettings(!showSettings);
  };

  // Notification component
  const Notification = ({ type, message, onClose }) => {
    return (
      <div className={`notification notification-${type}`}>
        <div className="notification-text">{message}</div>
        <button className="notification-close" onClick={onClose}>✕</button>
      </div>
    );
  };

  return (
    <div className="container">
      <header className="header">
        <h1>Posture Analyzer</h1>
        <p>Monitor and improve your sitting posture using AI</p>
      </header>

      <div className="main-content">
        <div className="webcam-section">
          {/* Webcam and canvas container */}
          <div className="card">
            {errorMessage && (
              <div className="error-message">{errorMessage}</div>
            )}

            <div className="webcam-container">
              {/* Loading state for model */}
              {isModelLoading && (
                <div className="camera-placeholder">
                  <div className="spinner"></div>
                  <p className="mt-4 text-muted">Loading posture detection model...</p>
                </div>
              )}

              {/* Camera permission state */}
              {!isModelLoading && !isWebcamEnabled && (
                <div className="camera-placeholder">
                  <svg className="camera-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <p className="mb-4 text-muted">Enable your webcam to start analyzing your posture</p>
                  <button className="btn btn-primary" onClick={setupWebcam}>Enable Camera</button>
                </div>
              )}

              {/* Camera loading state */}
              {!isModelLoading && isWebcamEnabled && !isWebcamLoaded && (
                <div className="skeleton-loader"></div>
              )}

              {/* Actual webcam and canvas */}
              <video 
                ref={webcamRef}
                id="webcam"
                autoPlay
                playsInline
                style={{ display: isWebcamLoaded ? 'block' : 'none' }}
              />
              <canvas 
                ref={canvasRef}
                id="canvas"
                style={{ display: isWebcamLoaded ? 'block' : 'none' }}
              />
            </div>

            {/* Posture status indicator */}
            {isWebcamLoaded && (
              <div className="posture-indicator">
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-lg font-semibold flex items-center">
                    Posture Status: 
                    <span className={`badge badge-${postureStatus}`}>
                      {postureStatus === 'good' ? 'Good' : 
                       postureStatus === 'warning' ? 'Warning' : 
                       postureStatus === 'bad' ? 'Bad' : 'Not Detected'}
                    </span>
                  </h2>
                  <div className="text-right">
                    <span className="text-sm text-muted">Posture Score</span>
                    <div className="text-xl font-bold">{postureScore}</div>
                  </div>
                </div>
                
                <div className="progress-track">
                  <div 
                    className="progress-fill" 
                    style={{ 
                      width: `${postureScore}%`,
                      backgroundColor: postureScore > 75 ? '#34D399' : postureScore > 40 ? '#FBBF24' : '#F87171'
                    }}
                  ></div>
                </div>
                
                <p className="posture-status">
                  {postureFeedback}
                </p>
              </div>
            )}

            {/* Control buttons */}
            {isWebcamLoaded && (
              <div className="btn-group">
                {!isDetecting ? (
                  <>
                    <button
                      className="btn btn-warning"
                      onClick={calibratePosture}
                    >
                      Calibrate Posture
                    </button>
                    <button
                      className="btn btn-success"
                      onClick={startPostureDetection}
                      disabled={!calibratedPosture}
                    >
                      Start Monitoring
                    </button>
                  </>
                ) : (
                  <button
                    className="btn btn-danger"
                    onClick={stopPostureDetection}
                  >
                    Stop Monitoring
                  </button>
                )}
                <button
                  className="btn btn-gray"
                  onClick={() => setShowReferenceLines(!showReferenceLines)}
                >
                  {showReferenceLines ? 'Hide Skeleton' : 'Show Skeleton'}
                </button>
                <button
                  className="btn btn-primary ml-auto"
                  onClick={toggleSettings}
                >
                  Settings
                </button>
                <button
                  className="btn btn-gray"
                  onClick={stopWebcam}
                >
                  Disable Camera
                </button>
              </div>
            )}
          </div>

          {/* Session stats */}
          <div className="card">
            <h2 className="section-title">Session Statistics</h2>
            
            <div className="stats-grid">
              <div className="stat-card">
                <h3>Current Session</h3>
                <p>{formatTime(stats.currentGoodTime + stats.currentBadTime)}</p>
              </div>
              <div className="stat-card">
                <h3>Good Posture</h3>
                <p className="good-posture-text">
                  {formatTime(stats.goodPostureTime + stats.currentGoodTime)}
                </p>
              </div>
              <div className="stat-card">
                <h3>Bad Posture</h3>
                <p className="bad-posture-text">
                  {formatTime(stats.badPostureTime + stats.currentBadTime)}
                </p>
              </div>
              <div className="stat-card">
                <h3>Posture Ratio</h3>
                <p>{calculatePostureRatio()}%</p>
              </div>
            </div>
            
            <div className="stats-grid mt-4">
              <div className="stat-card">
                <h3>Total Sessions</h3>
                <p>{stats.sessionsCount}</p>
              </div>
              <div className="stat-card">
                <h3>Last Session</h3>
                <p>{formatDate(stats.lastSession)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Settings panel */}
        <div className={`settings-panel ${showSettings ? 'open' : ''}`}>
          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-primary">Settings</h2>
              <button 
                className="close-settings-btn"
                onClick={toggleSettings}
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Sensitivity settings */}
              <div>
                <h3 className="text-lg font-medium mb-2">Sensitivity</h3>
                <p className="text-sm text-muted mb-2">
                  Adjust how strictly your posture is analyzed.
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Low</span>
                  <div className="flex gap-2">
                    {[1, 2, 3].map(level => (
                      <button
                        key={level}
                        className={`sensitivity-level ${sensitivityLevel === level ? 'active' : ''}`}
                        onClick={() => setSensitivityLevel(level)}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                  <span className="text-sm">High</span>
                </div>
              </div>
              
              {/* Reminders & Notifications */}
              <div>
                <h3 className="text-lg font-medium mb-2">Reminders & Alerts</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Audio Alerts</p>
                      <p className="text-sm text-muted">
                        Play sound for bad posture detection
                      </p>
                    </div>
                    <label className="toggle-switch">
                      <input 
                        type="checkbox" 
                        checked={isAudioEnabled}
                        onChange={() => setIsAudioEnabled(!isAudioEnabled)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Posture Reminders</p>
                      <p className="text-sm text-muted">
                        Periodic reminders to check posture
                      </p>
                    </div>
                    <label className="toggle-switch">
                      <input 
                        type="checkbox" 
                        checked={isReminderEnabled}
                        onChange={() => setIsReminderEnabled(!isReminderEnabled)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  
                  {isReminderEnabled && (
                    <div>
                      <p className="font-medium mb-1">Reminder Interval</p>
                      <div className="flex items-center">
                        <input
                          type="range"
                          min="5"
                          max="60"
                          step="5"
                          value={reminderInterval}
                          onChange={(e) => setReminderInterval(parseInt(e.target.value, 10))}
                          className="w-full"
                        />
                        <span className="ml-2 text-sm text-muted">
                          {reminderInterval} min
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Tips section */}
              <div>
                <h3 className="text-lg font-medium mb-2">Quick Tips</h3>
                <ul className="list-disc space-y-1 text-sm">
                  <li>Sit with your back straight and shoulders relaxed</li>
                  <li>Position your screen at eye level</li>
                  <li>Keep your feet flat on the floor</li>
                  <li>Take short breaks every 30 minutes</li>
                  <li>Do quick stretches during breaks</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="footer">
        <p>Created with React and TensorFlow.js</p>
        <p className="mt-1">Note: This application processes all data locally in your browser. No video is uploaded or stored.</p>
      </footer>

      {/* Notification */}
      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
}

export default App;