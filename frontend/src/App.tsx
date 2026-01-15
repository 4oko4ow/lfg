import { Navigate, Route, Routes } from "react-router-dom";
import Header from "./components/Header";
import LandingPage from "./pages/LandingPage";
import PartyFeedPage from "./pages/PartyFeedPage";
import ProfilePage from "./pages/ProfilePage";
import AuthCallbackPage from "./pages/AuthCallbackPage";

function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/feed" element={<PartyFeedPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/" element={<LandingPage />} />
        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>
    </>
  );
}

export default App;
