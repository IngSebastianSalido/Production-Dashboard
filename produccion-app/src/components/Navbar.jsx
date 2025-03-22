import React from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/logo.png'; // Importar el logo

const Navbar = () => {
  return (
    <nav style={styles.nav}>
      <div style={styles.brand}>
        <img src={logo} alt="Logo" style={styles.logo} /> {/* Usar el logo */}
      </div>
      <ul style={styles.navList}>
        <li style={styles.navItem}>
          <Link to="/rea" style={styles.navLink}>REA</Link>
        </li>
        <li style={styles.navItem}>
          <Link to="/" style={styles.navLink}>ProdChart</Link>
        </li>
        <li style={styles.navItem}>
          <Link to="/produccion" style={styles.navLink}>Hora por hora</Link>
        </li>
        <li style={styles.navItem}>
          <Link to="/grafica-paros" style={styles.navLink}>StopChart</Link>
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
    flexWrap: 'wrap', // Allow wrapping on smaller screens
    width: '100%', // Ensure full width
    position: 'fixed', // Fix the navbar at the top
    top: 0, // Align to the top
    left: 0, // Align to the left
    zIndex: 1000, // Ensure it stays on top of other content
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
  },
  logo: {
    height: '100px', // Ajusta el tamaño del logo según sea necesario
  },
  navList: {
    display: 'flex',
    listStyle: 'none',
    padding: 0,
    margin: 0,
    flexWrap: 'wrap', // Allow wrapping on smaller screens
  },
  navItem: {
    margin: '0 10px',
  },
  navLink: {
    color: 'white',
    textDecoration: 'none',
    padding: '10px 15px',
    display: 'block',
  },
  '@media (max-width: 600px)': {
    nav: {
      flexDirection: 'column',
      alignItems: 'flex-start',
    },
    navList: {
      flexDirection: 'column',
      width: '100%',
    },
    navItem: {
      width: '100%',
      textAlign: 'left',
    },
    navLink: {
      width: '100%',
      padding: '10px 20px',
    },
  },
  '@media (min-width: 601px)': {
    nav: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    navList: {
      flexDirection: 'row',
      width: 'auto',
    },
    navItem: {
      width: 'auto',
      textAlign: 'center',
    },
    navLink: {
      width: 'auto',
      padding: '10px 15px',
    },
  },
};

export default Navbar;