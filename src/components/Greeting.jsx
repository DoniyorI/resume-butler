"use client";
import {React, useState, useEffect } from "react";

function fetchGreeting() {
    return new Promise(resolve => {
      setTimeout(() => {
        const date = new Date();
        const hours = date.getHours();
        let greeting;
        if (hours < 12) {
          greeting = "Good Morning";
        } else if (hours < 18) {
          greeting = "Good Afternoon";
        } else {
          greeting = "Good Evening";
        }
        resolve(greeting);
      }, 1000); // Simulates a network request delay
    });
  }
  
  function Greeting() {
    const [greeting, setGreeting] = useState("Welcome");
    const [username, setUsername] = useState("User");
  
    useEffect(() => {
      fetchGreeting().then(greeting => {
        setGreeting(greeting);
      });
    }, []);
    return <h1 className="text-4xl font-bold text-[#559F87]">{greeting}, {username}</h1>;
  }
    function App() {
    return (
      <div className="">
        <Greeting />
      </div>
    );
  }
  
  export default App;