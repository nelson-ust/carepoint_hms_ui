type PageHeaderProps = {
  title: string;
  description?: string;
};

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <header className="mb-8 animate-slide-up">
      <h1 className="text-4xl font-display font-bold text-secondary-900 tracking-tight">
        {title}
      </h1>
      {description && (
        <p className="mt-3 text-base text-secondary-500 font-medium max-w-2xl">
          {description}
        </p>
      )}
    </header>
  );
}

