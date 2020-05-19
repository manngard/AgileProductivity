import React from "react";
import Day from "../day";
import "./index.css";
import Button from "../button";
import Arrow from "../arrow";
import NumberSelector2 from "../numberSelector2";
import { httpRequestJson } from "../../helpers/requests";
import Backend from "react-dnd-html5-backend";
import { DndProvider } from "react-dnd";

import { ItemTypes } from "../../helpers/constants";

const weekEndpoint = (year, week) => `/week?week=${year}${week}`;
const postTaskEndpoint = (date) => `/week?week=${date}`;
const deleteTaskEndpoint = (id) => `/week?week=${id}`;
const patchTaskEndpoint = "/week?key=value";
const getNotesEndpoint = "/notes?key=value";
const postNotesEndpoint = "/notes?key=value";
const deleteNotesEndpoint = (id) => `/notes?id=${id}`;

const weekDays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const yearMonths = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

class Week extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      days: [
        { date: "20200416", tasks: [] },
        { date: "20200417", tasks: [] },
        { date: "20200418", tasks: [] },
        { date: "20200419", tasks: [] },
        { date: "20200420", tasks: [] },
        { date: "20200421", tasks: [] },
        { date: "20200422", tasks: [] },
      ],

      notes: [],

      chosenWeek: this.getCurrentWeekNum(),
    };

    this.addTask = this.addTask.bind(this);
    this.deleteTask = this.deleteTask.bind(this);
    this.addNote = this.addNote.bind(this);
    this.deleteNote = this.deleteNote.bind(this);
    this.moveTask = this.moveTask.bind(this);
  }

  componentDidMount() {
    this.fetchWeekToState(2020, this.state.chosenWeek);
    this.fetchNotesToState();
  }

  fetchWeekToState(year, week) {
    httpRequestJson(weekEndpoint(year, week))
      .then((data) => {
        data.forEach((day) =>
          day.tasks.sort((a, b) => a.position - b.position)
        );
        this.setState({ days: data });
      })
      .catch((err) => {
        alert(err.message);
        console.error(err);
      });
  }

  fetchNotesToState() {
    httpRequestJson(getNotesEndpoint)
      .then((data) => {
        data.sort((a, b) => a.position - b.position);
        this.setState({ notes: data });
      })
      .catch((err) => {
        alert(err.message);
        console.error(err);
      });
  }

  getCurrentWeekNum() {
    let yr2 = new Date();
    let yr = new Date().getFullYear();
    let tdt = new Date(`January 4, ${yr}   01:15:00`);
    return (
      1 +
      Math.round(
        ((yr2.getTime() - tdt.getTime()) / 86400000 -
          3 +
          ((tdt.getDay() + 6) % 7)) /
        7
      )
    );
  }

  getCurrentWeekDay() {
    let day = new Date().getDay();
    if(day === 0) {
      return weekDays[6];
    }
    return weekDays[day - 1];
  }

  getCurrentYearMonth() {
    let month = new Date().getMonth();
    return yearMonths[month];
  }

  getCurrentYear() {
    return new Date().getFullYear();
  }

  SetCurrentWeekState = () => {
    const newWeek = this.getCurrentWeekNum();
    this.fetchWeekToState(2020, newWeek);
    this.setState({
      chosenWeek: newWeek,
    });
  };

  timeBlockDisplay() {
    let d = new Date().getDay();
    let weekDate = this.state.days[d].date;
    let month = parseInt(weekDate.slice(4, 6));
    let year = weekDate.slice(0, 4);
    return yearMonths[month - 1] + " " + year;
  }

  clickUp = () => {
    const newWeek = this.state.chosenWeek + 1;
    this.fetchWeekToState(2020, newWeek);
    this.setState({
      chosenWeek: newWeek,
    });
  };

  clickDown = () => {
    const newWeek = this.state.chosenWeek - 1;
    this.fetchWeekToState(2020, newWeek);
    this.setState({
      chosenWeek: newWeek,
    });
  };

  addTask(text, date, dayIndex, position = undefined) {
    const pos = position || this.state.days[dayIndex].tasks.length;
    const newTask = {
      text,
      date,
      state: 1,
      position: pos
    };

    const requestOptions = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newTask),
    };

    // Ensures no modification of the state object without setState
    const daysCopy = [...this.state.days];
    daysCopy[dayIndex] = { ...daysCopy[dayIndex] };
    daysCopy[dayIndex].tasks = [...daysCopy[dayIndex].tasks];
    if(position === undefined) {
      daysCopy[dayIndex].tasks.push(newTask);
    }
    else {
      daysCopy[dayIndex].tasks = this.insertAndShiftTask(daysCopy[dayIndex].tasks, newTask, pos);
    }
    this.setState({ days: daysCopy }); // Id gets added when the request resolves

    httpRequestJson(postTaskEndpoint(date), requestOptions)
      .then((data) => {
        const newDaysCopy = [ ...daysCopy ];
        newDaysCopy[dayIndex] = { ...newDaysCopy[dayIndex] };
        newDaysCopy[dayIndex].tasks = [ ...newDaysCopy[dayIndex].tasks ];
        newDaysCopy[dayIndex].tasks[pos] = { ...newDaysCopy[dayIndex].tasks[pos], id: data[0] }
        this.setState({ days: newDaysCopy });
      })
      .catch(() => alert("Failed to create task"));
  }

  deleteTask(id, dayIndex) {
    httpRequestJson(deleteTaskEndpoint(id), { method: "DELETE" }).catch(() =>
      alert("Failed to delete task")
    );

    const daysCopy = [...this.state.days];
    daysCopy[dayIndex] = { ...daysCopy[dayIndex] };
    daysCopy[dayIndex].tasks = [...daysCopy[dayIndex].tasks];
    const taskIndex = daysCopy[dayIndex].tasks.findIndex((x) => x.id === id);
    daysCopy[dayIndex].tasks.splice(taskIndex, 1);

    this.correctPositions(daysCopy[dayIndex].tasks);

    this.setState({ days: daysCopy });
  }

  // Could definitely use some refactoring, uses way too much duplication but does the job
  moveTask(source, destination) {
    if(source.type === ItemTypes.TASK && destination.type === ItemTypes.TASK) {
      this.moveDayTask(
        { date: source.item.timestamp, position: source.item.position },
        { date: destination.item.timestamp, position: destination.item.position }
      );
    }
    else if(source.type === ItemTypes.NOTE && destination.type === ItemTypes.NOTE) {
      this.moveNote(source.item.position, destination.item.position);
    }
    else if(source.type === ItemTypes.TASK && destination.type === ItemTypes.NOTE) {
      this.moveDayTaskToNote(source.item.timestamp, source.item.position, destination.item.position);
    }
    else if(source.type === ItemTypes.NOTE && destination.type === ItemTypes.TASK) {
      this.moveNoteToDayTask(source.item.position, destination.item.timestamp, destination.item.position);
    }
  }

  // Expects each parameter to be { date: yyyymmdd, position: X }
  moveDayTask(source, destination) {
    const sourceIndex = this.state.days.findIndex(day => source.date === day.date);
    const destinationIndex = this.state.days.findIndex(day => destination.date === day.date);

    // Duplicates week, relevant days and their tasks
    const daysCopy = [...this.state.days];
    daysCopy[sourceIndex] = { ...daysCopy[sourceIndex] };
    daysCopy[destinationIndex] = { ...daysCopy[destinationIndex] };
    daysCopy[sourceIndex].tasks = [...daysCopy[sourceIndex].tasks];
    daysCopy[destinationIndex].tasks = [...daysCopy[destinationIndex].tasks];

    // Extracts source task
    const sourceTask = daysCopy[sourceIndex].tasks.find(task => task.position === source.position);
    // Removes source task from its origin
    daysCopy[sourceIndex].tasks = daysCopy[sourceIndex].tasks.filter(task => task.position !== source.position);
    // Remove positional gap after removal
    this.correctPositions(daysCopy[sourceIndex].tasks);

    // Makes sure task has correct date to where it's positioned
    sourceTask.date = daysCopy[destinationIndex].date;

    // Slots in source task into destination and shifts tasks position below
    const newDayTasks = this.insertAndShiftTask(daysCopy[destinationIndex].tasks, sourceTask, destination.position);
    daysCopy[destinationIndex].tasks = newDayTasks;
    this.setState({ days: daysCopy });

    let patchBody;
    if(source.date === destination.date) {
      patchBody = daysCopy[sourceIndex].tasks.filter((_, i) => 
        i >= Math.min(source.position, destination.position));

        // Weird backend specific clause
        if(source.position < destination.position) {
          const patchDestinationIndex = patchBody.findIndex(x => x.id === sourceTask.id);
          patchBody[patchDestinationIndex] = { ...patchBody[patchDestinationIndex], position: patchBody[patchDestinationIndex].position+1 };
        }
    }
    else {
      const sourcePatchBody = daysCopy[sourceIndex].tasks.filter((_, i) => i >= source.position);
      const destinationPatchBody = daysCopy[destinationIndex].tasks.filter((_, i) => i >= destination.position);
      patchBody = [...sourcePatchBody, ...destinationPatchBody];
    }

    const requestOptions = {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patchBody),
    };

    httpRequestJson(patchTaskEndpoint, requestOptions)
      .catch(() => alert("Failed to move task"));
  }

  moveNote(sourcePosition, destinationPosition) {
    // Extracts note and closes positional gap
    let notesCopy = [...this.state.notes];
    const [sourceNote] = notesCopy.splice(sourcePosition, 1);
    this.correctPositions(notesCopy);

    notesCopy = this.insertAndShiftTask(notesCopy, sourceNote, destinationPosition);

    this.setState({ notes: notesCopy });
  }

  moveDayTaskToNote(dayDate, dayPosition, notePosition) {
    const sourceIndex = this.state.days.findIndex(day => dayDate === day.date);

    const { id, text } = this.state.days[sourceIndex].tasks[dayPosition];

    this.deleteTask(id, sourceIndex);
    this.addNote(text, notePosition);
  }

  moveNoteToDayTask(notePosition, dayDate, dayPosition) {
    const destinationIndex = this.state.days.findIndex(day => dayDate === day.date);

    const { date } = this.state.days[destinationIndex];
    const { id, text } = this.state.notes[notePosition];

    this.deleteNote(id);
    this.addTask(text, date, destinationIndex, dayPosition);
  }

  // Removes gaps in position through modification
  correctPositions(arr) {
    arr.sort((a, b) => a.position - b.position);
    arr.forEach((x, i) => (x.position = i));
  }

  insertAndShiftTask(tasks, newTask, newPos) {
    const firstPart = tasks.slice(0, newPos);
    const secondPart = tasks.slice(newPos, tasks.length)
      .map(x => ({ ...x, position: x.position + 1 }));

    return [...firstPart, { ...newTask, position: newPos }, ...secondPart];
  }

  addNote(text, position = undefined) {
    const pos = position || this.state.notes.length;
    const newNote = {
      text,
      position: pos
    };

    const requestOptions = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newNote),
    };

    let notesCopy = [ ...this.state.notes ];
    if(position === undefined) {
      notesCopy.push(newNote);
    }
    else {
      notesCopy = this.insertAndShiftTask(notesCopy, newNote, pos);
    }
    this.setState({ notes: notesCopy });

    httpRequestJson(postNotesEndpoint, requestOptions)
      .then((data) => {
        const newNotesCopy = [ ...notesCopy ];
        newNotesCopy[pos] = { ...newNotesCopy[pos], id: data[0] };
        this.setState({ notes: newNotesCopy });
      })
      .catch(() => alert("Failed to create note"));
  }

  deleteNote(id) {
    httpRequestJson(deleteNotesEndpoint(id), { method: "DELETE" }).catch(() =>
      alert("Failed to delete task")
    );

    const notesCopy = [...this.state.notes];
    const noteIndex = notesCopy.findIndex((x) => x.id === id);
    notesCopy.splice(noteIndex, 1);

    this.correctPositions(notesCopy);

    this.setState({ notes: notesCopy });
  }

  dateToDayConverter = (iDate) => {
    let date = typeof iDate === "string" ? iDate.substr(6, 7) : null;
    return date;
  };

  onChangeTaskState(taskId, i) {
    let daysCopy = this.state.days;
    const state = daysCopy[i].tasks.find((x) => x.id === taskId).state;
    let newState;
    if(state === 3) {
      newState = 1;
    } else {
      newState = state + 1;
    }

    daysCopy[i].tasks.find((x) => x.id === taskId).state = newState;

    this.setState({ days: daysCopy });
  }

  render() {
    return (
      <DndProvider backend={Backend}>
        <div className="week-view">
          <div className="week">
            <div className="week-header">
              <span>
                <div>
                  <NumberSelector2
                    handleClickUp={this.clickUp}
                    handleClickDown={this.clickDown}
                    value={this.state.chosenWeek}
                  />
                </div>
              </span>
              <h1 style={{ color: "grey" }}>{this.timeBlockDisplay()}</h1>
              <Button handleClick={this.SetCurrentWeekState}>Current week</Button>
            </div>
            <div className="days">
              {weekDays.map((x, i) => {
                const { tasks, date } = this.state.days[i];
                return (
                  <Day
                    todaysDay={this.getCurrentWeekDay()}
                    dayDate={this.dateToDayConverter(this.state.days[i].date)}
                    dayName={x}
                    tasks={tasks}
                    addTask={(text) => this.addTask(text, date, i)}
                    deleteTask={(id) => this.deleteTask(id, i)}
                    moveTask={(source, destination) => this.moveTask(source, destination)}
                    timestamp={date}
                    changeTaskState={(taskId) =>
                      this.onChangeTaskState(taskId, i)
                    }
                    key={JSON.stringify(this.state.days[i])}
                  />
                );
              })}
              <button onClick={this.clickDown} className="previous-week">
                <Arrow direction="left" />
              </button>
              <button onClick={this.clickUp} className="next-week">
                <Arrow direction="right" />
              </button>
            </div>
          </div>
          <div className="note-container">
            <Day
              dayName="Notes"
              tasks={this.state.notes}
              addTask={this.addNote}
              deleteTask={this.deleteNote}
              moveTask={this.moveTask}
            />
          </div>
        </div>
      </DndProvider>
    );
  }
}

export default Week;
