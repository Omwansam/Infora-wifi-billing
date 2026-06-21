import useReveal from '../hooks/useReveal';

export default function Reveal({
  children,
  className = '',
  delay = 0,
  direction = 'up',
  as: Tag = 'div',
}) {
  const { ref, visible } = useReveal();

  const transforms = {
    up: 'translateY(2rem)',
    down: 'translateY(-2rem)',
    left: 'translateX(2rem)',
    right: 'translateX(-2rem)',
    none: 'none',
  };

  return (
    <Tag
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : transforms[direction] || transforms.up,
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
      }}
    >
      {children}
    </Tag>
  );
}
