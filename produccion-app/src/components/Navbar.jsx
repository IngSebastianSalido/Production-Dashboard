import React from 'react';
import { Link } from 'react-router-dom';

const Navbar = () => {
  return (
    <nav style={styles.nav}>
      <div style={styles.brand}>FAIST METALMEX DASHBOARD</div>
      <ul style={styles.navList}>
        <li style={styles.navItem}>
          <Link to="/" style={styles.navLink}>Inicio</Link>
        </li>
        <li style={styles.navItem}>
          <Link to="/produccion" style={styles.navLink}>Hora por hora</Link>
        </li>
        <li style={styles.navItem}>
          <Link to="/stop" style={styles.navLink}>Registrar Paro</Link>
        </li>
        <li style={styles.navItem}>
          <Link to="/opciones" style={styles.navLink}>Configurar</Link>
        </li>
      </ul>
    </nav>
  );
};

const styles = {
  nav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 20px',
    backgroundColor: '#333',
    color: '#fff',
    position: 'fixed', // Posición fija
    top: 0, // Siempre en la parte superior
    width: '100%', // Que ocupe todo el ancho
    zIndex: 1000, // Superposición sobre otros elementos
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.3)',
  },
  brand: {
    fontSize: '1.5em',
    fontWeight: 'bold',
  },
  navList: {
    display: 'flex',
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  navItem: {
    margin: '0 10px',
  },
  navLink: {
    color: '#fff',
    textDecoration: 'none',
    fontSize: '1em',
    padding: '5px 10px',
    borderRadius: '5px',
    transition: 'all 0.3s ease',
  },
  navLinkHover: {
    backgroundColor: '#444',
  },
};

export default Navbar;
