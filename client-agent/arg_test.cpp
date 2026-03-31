#include <iostream>
int main(int argc, char** argv) {
    for (int i=0; i<argc; i++) {
        std::cout << "ARG " << i << ": " << argv[i] << "\n";
    }
    return 0;
}
