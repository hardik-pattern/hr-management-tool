import { type MouseEvent, useEffect, useRef } from 'react'
import { Container, Nav, Navbar } from 'react-bootstrap'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

export default function Layout() {
  const { pathname } = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const previousPath = useRef(pathname)

  // A single-page app never reloads, so after moving to another page the
  // keyboard and screen-reader position would stay on the link just clicked.
  // Moving focus to the new page's content makes the change noticeable.
  // Changes of filters or sort (same path) leave focus where it is.
  useEffect(() => {
    if (previousPath.current === pathname) return
    previousPath.current = pathname
    mainRef.current?.focus()
  }, [pathname])

  const skipToContent = (event: MouseEvent) => {
    event.preventDefault()
    mainRef.current?.focus()
  }

  return (
    <>
      <a
        href="#main"
        onClick={skipToContent}
        className="visually-hidden-focusable position-absolute bg-white text-dark p-2 m-2 rounded"
        style={{ zIndex: 2000 }}
      >
        Skip to main content
      </a>
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
      <Container as="main" id="main" tabIndex={-1} ref={mainRef} className="py-4">
        <Outlet />
      </Container>
    </>
  )
}
