import { Component } from 'solid-js'
import LandingPage from './components/LandingPage'
import SetupGuide from './components/SetupGuide'
import DemoQuery from './components/DemoQuery'
import './App.css'

const App: Component = () => {
  return (
    <>
      <LandingPage />
      <SetupGuide />
      <DemoQuery />
    </>
  )
}

export default App
