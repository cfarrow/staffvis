from dataclasses import dataclass

from .harvest_utils import get_forecast


@dataclass
class ProjectAssignment:
    project_id: int
    manager: str
    hours: float
    flex: bool = False


@dataclass
class Allocation:
    engineer: str
    assignments: list[ProjectAssignment]


# Helper to extract a name from a person json response
_person_to_name = "{first_name} {last_name}".format_map


def fetch_allocations() -> list[Allocation]:
    """ Fetch allocations from Forecast.

    Returns
    -------
    allocations : list of Allocation
        The allocations organized per engineer.
    """

    # Fetch and unsheath
    assignments = get_forecast("assignments")["assignments"]

    # We'll want to find people by their ID
    people = get_forecast("people")["people"]
    people = dict((d['id'], d) for d in people)

    # Allocations by person_id.
    allocations = {}

    # Sweep the assignments and organize them by engineer, packing each into the
    # proper data structure as we go.
    for assn in assignments:
        project_id = assn['project_id']
        person_id = assn['person_id']

        # Get or create the allocation for the engineer
        if person_id in allocations:
            alloc = allocations[person_id]
        else:
            person = people[person_id]
            name = _person_to_name(person)
            alloc = Allocation(engineer=name, assignments=[])
            allocations[person_id] = alloc

        # Extract the assignment data. We assume that the last person to modify
        # the allocation is the manager.
        manager_id = assn['updated_by_id']
        manager = _person_to_name(people[manager_id])
        hours = assn['allocation']
        if hours is None:
            continue
        hours /= 3600  # convert to hours for easier debugging
        notes = assn['notes']
        flex = False if notes is None else "FLEX" in notes

        # Create and store the ProjectAssignment. Note that we use the project
        # id since the name and client are not used anywhere. This saves a call
        # to Forecast.
        passn = ProjectAssignment(
            project_id=project_id,
            manager=manager,
            hours=hours,
            flex=flex
        )
        alloc.assignments.append(passn)

    return list(allocations.values())