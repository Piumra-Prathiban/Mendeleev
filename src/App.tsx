function App() {
  return (
    <div className="flex h-full w-full">
      <aside
        aria-label="Notes list"
        className="w-[260px] shrink-0 border-r border-neutral-200 dark:border-neutral-800"
      />
      <main aria-label="Editor" className="flex-1" />
    </div>
  );
}

export default App;
