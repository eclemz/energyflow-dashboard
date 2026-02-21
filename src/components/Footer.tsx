function Footer() {
  return (
    <footer className="border-t border-zinc-800">
      <div className="px-6 py-8 text-sm text-zinc-500 flex flex-col md:flex-row items-center justify-between gap-4">
        <p>© {new Date().getFullYear()} EnergyFlow</p>

        <div className="flex items-center gap-6">
          <a
            href="https://github.com/eclemz/energyflow-api"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition"
          >
            View Backend Code
          </a>

          <a
            href="https://github.com/eclemz/energyflow-web"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition"
          >
            View Frontend Code
          </a>

          <span className="text-zinc-600">Built by Clement Eneh</span>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
