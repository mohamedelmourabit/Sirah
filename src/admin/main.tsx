/// <reference types="vite/client" />
import { createRoot } from 'react-dom/client'
import '../index.css'
import Admin from './Admin'

createRoot(document.getElementById('root')!).render(<Admin />)
