import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// Main App Component
const App = () => {
  const [workouts, setWorkouts] = useState([]);
  const [currentWorkout, setCurrentWorkout] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  
  // Load workouts from session storage
  useEffect(() => {
    const savedWorkouts = JSON.parse(sessionStorage.getItem('workouts')) || [];
    if (savedWorkouts.length > 0) {
      setWorkouts(savedWorkouts);
    }
    
    const savedCurrentWorkout = JSON.parse(sessionStorage.getItem('currentWorkout'));
    if (savedCurrentWorkout) {
      setCurrentWorkout(savedCurrentWorkout);
    }
  }, []);
  
  // Save workouts to session storage whenever they change
  useEffect(() => {
    sessionStorage.setItem('workouts', JSON.stringify(workouts));
  }, [workouts]);
  
  // Save current workout to session storage whenever it changes
  useEffect(() => {
    if (currentWorkout) {
      sessionStorage.setItem('currentWorkout', JSON.stringify(currentWorkout));
    } else {
      sessionStorage.removeItem('currentWorkout');
    }
  }, [currentWorkout]);
  
  const startNewWorkout = () => {
    const newWorkout = {
      id: Date.now(),
      date: new Date().toISOString(),
      exercises: [],
      notes: '',
      completed: false
    };
    setCurrentWorkout(newWorkout);
    setShowHistory(false);
  };
  
  const addExercise = (exerciseName) => {
    if (!exerciseName.trim()) return;
    
    const newExercise = {
      id: Date.now(),
      name: exerciseName,
      sets: []
    };
    
    setCurrentWorkout({
      ...currentWorkout,
      exercises: [...currentWorkout.exercises, newExercise]
    });
  };
  
  const addSet = (exerciseId, weight, reps) => {
    const newSet = {
      id: Date.now(),
      weight: Number(weight),
      reps: Number(reps),
      timestamp: new Date().toISOString()
    };
    
    const updatedExercises = currentWorkout.exercises.map(exercise => {
      if (exercise.id === exerciseId) {
        return {
          ...exercise,
          sets: [...exercise.sets, newSet]
        };
      }
      return exercise;
    });
    
    setCurrentWorkout({
      ...currentWorkout,
      exercises: updatedExercises
    });
  };
  
  const removeExercise = (exerciseId) => {
    const updatedExercises = currentWorkout.exercises.filter(
      exercise => exercise.id !== exerciseId
    );
    
    setCurrentWorkout({
      ...currentWorkout,
      exercises: updatedExercises
    });
  };
  
  const removeSet = (exerciseId, setId) => {
    const updatedExercises = currentWorkout.exercises.map(exercise => {
      if (exercise.id === exerciseId) {
        return {
          ...exercise,
          sets: exercise.sets.filter(set => set.id !== setId)
        };
      }
      return exercise;
    });
    
    setCurrentWorkout({
      ...currentWorkout,
      exercises: updatedExercises
    });
  };
  
  const updateNotes = (notes) => {
    setCurrentWorkout({
      ...currentWorkout,
      notes: notes
    });
  };
  
  const completeWorkout = () => {
    if (currentWorkout.exercises.length === 0) {
      alert('Add at least one exercise before completing the workout');
      return;
    }
    
    const completedWorkout = {
      ...currentWorkout,
      completed: true,
      endTime: new Date().toISOString()
    };
    
    setWorkouts([...workouts, completedWorkout]);
    setCurrentWorkout(null);
  };
  
  const discardWorkout = () => {
    if (window.confirm('Are you sure you want to discard this workout?')) {
      setCurrentWorkout(null);
    }
  };
  
  const viewWorkoutDetails = (workoutId) => {
    const workout = workouts.find(w => w.id === workoutId);
    if (workout) {
      setCurrentWorkout(workout);
      setShowHistory(false);
    }
  };
  
  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2 text-primary dark:text-primary">
          <i className="fas fa-dumbbell mr-2"></i>Workout Tracker
        </h1>
        <p className="text-gray-600 dark:text-gray-300">Record and track your fitness progress</p>
      </header>
      
      {!currentWorkout && !showHistory && (
        <div className="flex flex-col items-center justify-center space-y-6 py-12">
          <button 
            onClick={startNewWorkout}
            className="bg-primary hover:bg-primary-hover text-white font-medium rounded-lg text-xl px-8 py-4 transition-colors duration-200 flex items-center"
          >
            <i className="fas fa-plus-circle mr-2"></i>
            Start New Workout
          </button>
          
          {workouts.length > 0 && (
            <button 
              onClick={() => setShowHistory(true)}
              className="mt-4 text-primary dark:text-primary hover:underline font-medium flex items-center"
            >
              <i className="fas fa-history mr-2"></i>
              View Workout History
            </button>
          )}
        </div>
      )}
      
      {currentWorkout && !currentWorkout.completed && (
        <WorkoutForm 
          workout={currentWorkout}
          addExercise={addExercise}
          addSet={addSet}
          removeExercise={removeExercise}
          removeSet={removeSet}
          updateNotes={updateNotes}
          completeWorkout={completeWorkout}
          discardWorkout={discardWorkout}
        />
      )}
      
      {currentWorkout && currentWorkout.completed && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Workout Details</h2>
            <button 
              onClick={() => setCurrentWorkout(null)}
              className="text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary"
            >
              <i className="fas fa-times-circle text-xl"></i>
            </button>
          </div>
          <WorkoutSummary workout={currentWorkout} />
          <div className="mt-6 text-center">
            <button 
              onClick={() => setCurrentWorkout(null)}
              className="bg-primary hover:bg-primary-hover text-white font-medium rounded-lg px-5 py-2.5 transition-colors duration-200"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      )}
      
      {showHistory && (
        <WorkoutHistory 
          workouts={workouts} 
          viewWorkoutDetails={viewWorkoutDetails}
          goBack={() => setShowHistory(false)}
        />
      )}
    </div>
  );
};

// Workout Form Component
const WorkoutForm = ({ 
  workout, 
  addExercise, 
  addSet, 
  removeExercise, 
  removeSet, 
  updateNotes, 
  completeWorkout, 
  discardWorkout 
}) => {
  const [newExerciseName, setNewExerciseName] = useState('');
  const [activeExercise, setActiveExercise] = useState(null);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const exerciseInputRef = useRef(null);
  
  const handleAddExercise = (e) => {
    e.preventDefault();
    if (!newExerciseName.trim()) {
      if (exerciseInputRef.current) {
        exerciseInputRef.current.classList.add('shake');
        setTimeout(() => {
          exerciseInputRef.current.classList.remove('shake');
        }, 500);
      }
      return;
    }
    
    addExercise(newExerciseName);
    setNewExerciseName('');
  };
  
  const handleAddSet = (e, exerciseId) => {
    e.preventDefault();
    if (!weight || !reps) return;
    
    addSet(exerciseId, weight, reps);
    setWeight('');
    setReps('');
  };
  
  const toggleExercise = (exerciseId) => {
    if (activeExercise === exerciseId) {
      setActiveExercise(null);
    } else {
      setActiveExercise(exerciseId);
    }
  };
  
  const formatDate = (dateString) => {
    const options = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };
  
  return (
    <div className="workout-container bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-2xl font-bold">Current Workout</h2>
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {formatDate(workout.date)}
          </span>
        </div>
        <div className="h-1 w-full bg-primary rounded-full"></div>
      </div>
      
      <form onSubmit={handleAddExercise} className="mb-6">
        <label htmlFor="exercise-name" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          Add Exercise
        </label>
        <div className="flex">
          <input
            type="text"
            id="exercise-name"
            ref={exerciseInputRef}
            className="bg-gray-50 border border-gray-300 text-gray-900 text-base rounded-lg focus:ring-primary focus:border-primary block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-primary dark:focus:border-primary"
            placeholder="e.g., Bench Press, Squat, Deadlift"
            value={newExerciseName}
            onChange={(e) => setNewExerciseName(e.target.value)}
            required
          />
          <button
            type="submit"
            className="ml-2 text-white bg-primary hover:bg-primary-hover focus:ring-4 focus:outline-none focus:ring-primary/50 font-medium rounded-lg text-sm px-4 py-2.5 text-center inline-flex items-center"
          >
            <i className="fas fa-plus mr-1"></i> Add
          </button>
        </div>
      </form>
      
      {workout.exercises.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <i className="fas fa-dumbbell text-4xl mb-4"></i>
          <p>No exercises added yet. Start by adding an exercise above.</p>
        </div>
      ) : (
        <div className="space-y-4 mb-6">
          {workout.exercises.map(exercise => (
            <div key={exercise.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div 
                className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700 cursor-pointer"
                onClick={() => toggleExercise(exercise.id)}
              >
                <h3 className="text-lg font-semibold">{exercise.name}</h3>
                <div className="flex items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-300 mr-3">
                    {exercise.sets.length} {exercise.sets.length === 1 ? 'set' : 'sets'}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeExercise(exercise.id);
                    }}
                    className="text-red-500 hover:text-red-700 dark:hover:text-red-400 mr-2"
                    aria-label="Remove exercise"
                  >
                    <i className="fas fa-trash-alt"></i>
                  </button>
                  <i className={`fas ${activeExercise === exercise.id ? 'fa-chevron-up' : 'fa-chevron-down'} text-gray-500`}></i>
                </div>
              </div>
              
              {activeExercise === exercise.id && (
                <div className="p-4 bg-white dark:bg-gray-800">
                  {exercise.sets.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-medium mb-2 text-sm text-gray-600 dark:text-gray-300">Sets</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-700 dark:text-gray-300">
                          <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-300">
                            <tr>
                              <th scope="col" className="px-3 py-2">Set</th>
                              <th scope="col" className="px-3 py-2">Weight</th>
                              <th scope="col" className="px-3 py-2">Reps</th>
                              <th scope="col" className="px-3 py-2">Time</th>
                              <th scope="col" className="px-3 py-2">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {exercise.sets.map((set, index) => (
                              <tr key={set.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                                <td className="px-3 py-2">{index + 1}</td>
                                <td className="px-3 py-2">{set.weight} kg</td>
                                <td className="px-3 py-2">{set.reps}</td>
                                <td className="px-3 py-2">
                                  {new Date(set.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="px-3 py-2">
                                  <button
                                    onClick={() => removeSet(exercise.id, set.id)}
                                    className="text-red-500 hover:text-red-700 dark:hover:text-red-400"
                                    aria-label="Remove set"
                                  >
                                    <i className="fas fa-times"></i>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  
                  <form onSubmit={(e) => handleAddSet(e, exercise.id)}>
                    <h4 className="font-medium mb-2 text-sm text-gray-600 dark:text-gray-300">Add Set</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label htmlFor={`weight-${exercise.id}`} className="block mb-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                          Weight (kg)
                        </label>
                        <input
                          type="number"
                          id={`weight-${exercise.id}`}
                          className="bg-gray-50 border border-gray-300 text-gray-900 text-base rounded-lg focus:ring-primary focus:border-primary block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-primary dark:focus:border-primary"
                          min="0"
                          step="0.5"
                          value={weight}
                          onChange={(e) => setWeight(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor={`reps-${exercise.id}`} className="block mb-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                          Reps
                        </label>
                        <input
                          type="number"
                          id={`reps-${exercise.id}`}
                          className="bg-gray-50 border border-gray-300 text-gray-900 text-base rounded-lg focus:ring-primary focus:border-primary block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-primary dark:focus:border-primary"
                          min="1"
                          value={reps}
                          onChange={(e) => setReps(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="mt-3 w-full text-white bg-primary hover:bg-primary-hover focus:ring-4 focus:outline-none focus:ring-primary/50 font-medium rounded-lg text-sm px-5 py-2.5 text-center"
                    >
                      <i className="fas fa-plus mr-1"></i> Add Set
                    </button>
                  </form>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      <div className="mb-6">
        <label htmlFor="workout-notes" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          Workout Notes
        </label>
        <textarea
          id="workout-notes"
          rows="3"
          className="bg-gray-50 border border-gray-300 text-gray-900 text-base rounded-lg focus:ring-primary focus:border-primary block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-primary dark:focus:border-primary"
          placeholder="Add any notes about this workout..."
          value={workout.notes}
          onChange={(e) => updateNotes(e.target.value)}
        ></textarea>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          type="button"
          onClick={completeWorkout}
          className="text-white bg-green-600 hover:bg-green-700 focus:ring-4 focus:outline-none focus:ring-green-300 font-medium rounded-lg text-base px-5 py-3 text-center dark:bg-green-500 dark:hover:bg-green-600 dark:focus:ring-green-700"
        >
          <i className="fas fa-check-circle mr-2"></i>
          Complete Workout
        </button>
        <button
          type="button"
          onClick={discardWorkout}
          className="text-gray-700 bg-gray-200 hover:bg-gray-300 focus:ring-4 focus:outline-none focus:ring-gray-100 font-medium rounded-lg text-base px-5 py-3 text-center dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:focus:ring-gray-700"
        >
          <i className="fas fa-times-circle mr-2"></i>
          Discard Workout
        </button>
      </div>
    </div>
  );
};

// Workout Summary Component
const WorkoutSummary = ({ workout }) => {
  const formatDate = (dateString) => {
    const options = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };
  
  const calculateDuration = () => {
    if (!workout.endTime) return 'N/A';
    
    const start = new Date(workout.date);
    const end = new Date(workout.endTime);
    const diffMs = end - start;
    
    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes}m`;
  };
  
  const totalSets = workout.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
  const totalReps = workout.exercises.reduce((sum, exercise) => {
    return sum + exercise.sets.reduce((setSum, set) => setSum + set.reps, 0);
  }, 0);
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-2">Workout Summary</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">Date</p>
            <p className="font-semibold">{formatDate(workout.date)}</p>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">Duration</p>
            <p className="font-semibold">{calculateDuration()}</p>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">Exercises</p>
            <p className="font-semibold">{workout.exercises.length}</p>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Sets</p>
            <p className="font-semibold">{totalSets}</p>
          </div>
        </div>
      </div>
      
      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-4">Exercises</h3>
        {workout.exercises.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">No exercises recorded</p>
        ) : (
          <div className="space-y-4">
            {workout.exercises.map(exercise => (
              <div key={exercise.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <div className="bg-gray-50 dark:bg-gray-700 p-3">
                  <h4 className="font-medium">{exercise.name}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {exercise.sets.length} {exercise.sets.length === 1 ? 'set' : 'sets'}, 
                    {exercise.sets.reduce((sum, set) => sum + set.reps, 0)} reps total
                  </p>
                </div>
                {exercise.sets.length > 0 && (
                  <div className="p-3">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left text-gray-700 dark:text-gray-300">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-300">
                          <tr>
                            <th scope="col" className="px-3 py-2">Set</th>
                            <th scope="col" className="px-3 py-2">Weight</th>
                            <th scope="col" className="px-3 py-2">Reps</th>
                            <th scope="col" className="px-3 py-2">Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {exercise.sets.map((set, index) => (
                            <tr key={set.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                              <td className="px-3 py-2">{index + 1}</td>
                              <td className="px-3 py-2">{set.weight} kg</td>
                              <td className="px-3 py-2">{set.reps}</td>
                              <td className="px-3 py-2">
                                {new Date(set.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      
      {workout.notes && (
        <div>
          <h3 className="text-xl font-semibold mb-2">Notes</h3>
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="whitespace-pre-line">{workout.notes}</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Workout History Component
const WorkoutHistory = ({ workouts, viewWorkoutDetails, goBack }) => {
  const sortedWorkouts = [...workouts].sort((a, b) => new Date(b.date) - new Date(a.date));
  
  const formatDate = (dateString) => {
    const options = { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 workout-container">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Workout History</h2>
        <button 
          onClick={goBack}
          className="text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary"
        >
          <i className="fas fa-arrow-left mr-1"></i> Back
        </button>
      </div>
      
      {sortedWorkouts.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <i className="fas fa-history text-4xl mb-4"></i>
          <p>No workout history available yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedWorkouts.map(workout => (
            <div 
              key={workout.id} 
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              onClick={() => viewWorkoutDetails(workout.id)}
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-semibold text-lg">
                    Workout on {formatDate(workout.date)}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {workout.exercises.length} exercises, 
                    {workout.exercises.reduce((sum, ex) => sum + ex.sets.length, 0)} sets total
                  </p>
                </div>
                <i className="fas fa-chevron-right text-gray-400"></i>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default App;