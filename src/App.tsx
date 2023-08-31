import './App.css';
import { useTranslation } from 'react-i18next';
import GlobalSearch from './pages/globalSearch';


export default function App() {
  const { t } = useTranslation();
  //@ts-ignore
  window.t = t
  return <GlobalSearch />;
}