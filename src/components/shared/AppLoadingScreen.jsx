function AppLoadingScreen({
  title = "Loading Class Connect",
  message = "Preparing your workspace...",
}) {
  return (
    <div className="app-loading-screen">
      <div className="app-loading-card">
        <div className="app-loading-logo-wrap">
          <img src="/bird.png" alt="" />
        </div>
        <div className="app-loading-copy">
          <h2>{title}</h2>
          <span>{message}</span>
        </div>
        <div className="app-loading-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

export default AppLoadingScreen;
