# Makefile for test-debug-labels

CXX = clang++
CXXFLAGS = -std=c++17 -O2 -Wall
MLX_PATH = $(HOME)/ml-explore/mlx
INCLUDES = -I$(MLX_PATH)
LDFLAGS = -L$(MLX_PATH)/build-release -lmlx -Wl,-rpath,$(MLX_PATH)/build-release -framework Metal -framework Foundation -framework Accelerate

TARGET = test-debug-labels
SOURCE = main.cpp

all: $(TARGET)

$(TARGET): $(SOURCE)
	$(CXX) $(CXXFLAGS) $(INCLUDES) -o $(TARGET) $(SOURCE) $(LDFLAGS)

run: $(TARGET)
	./$(TARGET)

clean:
	rm -f $(TARGET) *.gputrace

.PHONY: all run clean
