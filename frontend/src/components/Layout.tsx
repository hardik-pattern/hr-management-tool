import { Container, Nav, Navbar } from 'react-bootstrap'
import { NavLink, Outlet } from 'react-router-dom'

export default function Layout() {
  return (
    <>
      <Navbar bg="dark" data-bs-theme="dark" expand="md">
        <Container>
          <Navbar.Brand as={NavLink} to="/">
            ACME Salary Manager
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="main-nav" />
          <Navbar.Collapse id="main-nav">
            <Nav as="nav" aria-label="Main">
              <Nav.Link as={NavLink} to="/employees">
                Employees
              </Nav.Link>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      <Container as="main" className="py-4">
        <Outlet />
      </Container>
    </>
  )
}
